import { Injectable } from '@angular/core';
import * as $ from 'jquery';
import '../../../assets/js/jquery.hammer.js';
import { SpanService } from '../span/span.service';
import { SegmentDetailComponent } from '../../components/segment-detail/segment-detail.component';
import { LogService } from '../log/log.service';
import { InteractionSource } from '../../model/InteractionSource';
import { SpeechService } from '../speech/speech.service';
import { TouchDistinguisher } from '../../util/touch-distinguisher';
import { InteractionModality } from '../../model/InteractionModality';
import { CapitalizationService } from '../capitalization/capitalization.service';
import * as CoordCalcUtils from '../../util/coord-calc-utils';

interface RelPos {
  refEl: HTMLElement; // the reference element
  left: boolean; // whether left or right
}

enum PartOfWord {
  Left = 0,
  Right = 1,
  Middle = 2,
}

@Injectable({
  providedIn: 'root',
})
export class ReorderService {
  private static component: SegmentDetailComponent;

  private dragInProgress = false;
  public touchInProgress = false; // this is also needed because otherwise a scroll could trigger a drag, which we prevent
  private isMultiWordDrag = false; // requires different handling, so we need to memorize this

  private dragWasSentenceBeginning = false; // store for capitalization updates

  private dragDeltaX = 0;
  private dragDeltaY = 0;
  public dragEl: HTMLElement; // the item below the user's finger
  private oldEl: HTMLElement; // the copy of that item s.t. space is kept
  private interactionModality: InteractionModality;

  public dragElStartX = 0;
  public dragElStartY = 0;

  private oldPos: RelPos = { refEl: undefined, left: false };
  private insertPosition: HTMLElement;
  private oldSegmentText: string;
  private oldDragPos: string;

  // for caching if the move was intended or we have just a little bit of flickering during D&D
  private lastActualMove: number = Date.now();
  private flickerThreshold = 100; // for trading off flickering (low number) against slow reaction (high)

  constructor(private logService: LogService, private speechService: SpeechService, private capitalizationService: CapitalizationService) {}

  public static registerComponent(segmentDetailComponent: SegmentDetailComponent): void {
    this.component = segmentDetailComponent;
  }

  /**
   * Tests if, in terms of relative coordinates, el1 is in el2.
   * @param el1 - the element which is tested to be in el2
   * @param el2 - the element which el1 is tested to be within
   */
  private static isInElementRelative(el1: HTMLElement, el2: HTMLElement): boolean {
    const [x, y] = ReorderService.getCenterPointRelative(el1);
    return x >= el2.offsetLeft && x <= el2.offsetLeft + el2.offsetWidth && y >= el2.offsetTop && y <= el2.offsetTop + el2.offsetHeight;
  }

  /**
   * Calculates the relative coordinates (to parent) of the center point of an element.
   * @param element - the element
   */
  private static getCenterPointRelative(element: HTMLElement): [number, number] {
    const centerX = element.offsetLeft + element.offsetWidth / 2;
    const centerY = element.offsetTop + element.offsetHeight / 2;
    return [centerX, centerY];
  }

  /**
   * Calculates the absolute coordiantes of the center point of an element.
   * @param element - the element
   */
  private static getCenterPointAbsolute(element: HTMLElement): [number, number] {
    const offset = CoordCalcUtils.getOffset(element);
    const centerX = offset.left + element.offsetWidth / 2;
    const centerY = offset.top + element.offsetHeight / 2;
    return [centerX, centerY];
  }

  private static getAbsolutePositionTopLeft(element: HTMLElement): [number, number] {
    const offset = CoordCalcUtils.getOffset(element);
    const x = offset.left;
    const y = offset.top;
    return [x, y];
  }

  private static getAbsolutePositionTopRight(element: HTMLElement): [number, number] {
    const offset = CoordCalcUtils.getOffset(element);
    const x = offset.left + element.offsetWidth;
    const y = offset.top;
    return [x, y];
  }

  /**
   * This function should be called whenever the view changed, s.t. the data model is updated, undo/redo etc.
   */
  private static updateModel(): void {
    ReorderService.component.updateModel(ReorderService.component.mainDiv.nativeElement.innerText, true, false, false);
  }

  public onPanStart(event) {
    console.log('OnPanStart', event);
    // if there is a selection, apply the default drag and drop
    const sel = window.getSelection();

    if (
      !this.touchInProgress &&
      !this.dragInProgress &&
      (event.gesture.pointerType === 'touch' || event.gesture.pointerType === 'pen' || event.gesture.pointerType === 'midair')
    ) {
      if (
        sel &&
        sel.anchorNode &&
        sel.toString() !== '' &&
        sel.anchorNode.parentElement &&
        sel.anchorNode.parentElement.parentElement &&
        sel.anchorNode.parentElement.parentElement.id === 'mainDiv'
      ) {
        // use selection: create a single span around whole selection
        const anchorNode = sel.anchorNode.parentElement;
        this.dragEl = $('<span>' + sel.toString() + '</span>')[0];
        anchorNode.parentElement.insertBefore(this.dragEl, anchorNode);
        sel.deleteFromDocument();
        // store that we are multi-word case, so that we can trigger a full recreation of the spans in the end
        this.isMultiWordDrag = true;
        // Check if dragEL was moved from start
        this.dragWasSentenceBeginning = anchorNode.id === 'mainDivSpan0';
        this.oldDragPos = anchorNode.id;
      } else {
        // no selection --> just use the span of the event
        this.dragEl = event.gesture.target;
        this.isMultiWordDrag = false;
        // Check if dragEL was moved from start
        this.dragWasSentenceBeginning = this.dragEl.id === 'mainDivSpan0';
        this.oldDragPos = this.dragEl.id;
      }

      // check the event soruce
      if(event.gesture.pointerType === 'midair'){
        this.interactionModality = InteractionModality.MIDAIRGESTURES;
      } else {
        this.interactionModality = TouchDistinguisher.isPenOrFinger();
      }
      if (this.dragEl.innerText !== ' ' && this.dragEl.id !== 'mainDiv') {
        this.oldSegmentText = ReorderService.component.mainDiv.nativeElement.innerText;
        // Update start position of the drag
        this.dragElStartX = this.dragEl.offsetLeft;
        this.dragElStartY = this.dragEl.offsetTop;
        this.dragDeltaX = event.gesture.deltaX;
        this.dragDeltaY = event.gesture.deltaY;
        // copy this element and put it at the same position s.t. space is kept which avoids the text from jumping
        this.oldEl = this.dragEl.cloneNode(true) as HTMLElement;
        this.oldEl.classList.add('dragged');
        this.dragEl.parentElement.insertBefore(this.oldEl, this.dragEl);
        // Make the element's position absolute, so that it can be freely moved
        this.dragEl.style.position = 'absolute';
        // Apply styling to dragged element
        this.dragEl.classList.add('dragging');
        // put dragEL at correct position (namely that of finger)
        this.dragEl.style.left = this.dragElStartX + this.dragDeltaX + 'px';
        this.dragEl.style.top = this.dragElStartY + this.dragDeltaY + 'px';
        // Memorize that dragging process running (otherwise we get interference from PanStart and Press
        this.dragInProgress = true;
        // log pan start
        this.logService.logDragStart(
          this.interactionModality,
          this.dragEl.innerText,
          this.dragEl.id,
          ReorderService.component.mainDiv.nativeElement.innerText,
        );
      }
    }
  }

  public onPanMove(event) {
    // console.log(event.gesture.srcEvent.x, event.gesture.srcEvent.y);
    if (
      (this.dragInProgress && event.gesture.pointerType === 'touch') ||
      event.gesture.pointerType === 'pen' ||
      event.gesture.pointerType === 'midair' ||
      event.gesture.pointerType === 'mouse'
    ) {
      if (this.dragEl && this.dragEl.innerText !== ' ' && this.dragEl.id !== 'mainDiv') {
        // console.log('OnPanMove');
        // event.preventDefault();
        this.dragDeltaX = event.gesture.deltaX;
        this.dragDeltaY = event.gesture.deltaY;
        if (this.dragDeltaX && this.dragDeltaY) {
          // Update the element's current position
          if (this.dragEl.style) {
            this.dragEl.style.left = this.dragElStartX + this.dragDeltaX + 'px';
            this.dragEl.style.top = this.dragElStartY + this.dragDeltaY + 'px';
            // Put some insert position indicator at the closest text position to show the user what would happen
            if (ReorderService.isInElementRelative(this.dragEl, event.target)) {
              // console.log(event.gesture.srcEvent.x, event.gesture.srcEvent.y);
              this.visualizeInsertPosition(this.dragEl, event.gesture.srcEvent.x, event.gesture.srcEvent.y);
              if (this.insertPosition) {
                this.insertPosition.style.display = 'block'; // make it visible again
              }
            } else {
              if (this.insertPosition) {
                this.insertPosition.style.display = 'none'; // make it none s.t. it is completely hidden
              }
            }
          }
        }
      }
    }
  }

  public onPanEnd(event) {
    if (event.gesture.pointerType === 'touch' || event.gesture.pointerType === 'pen' || event.gesture.pointerType === 'midair') {
      if (this.dragEl && this.dragEl.innerText !== ' ' && this.dragEl.id !== 'mainDiv') {
        console.log('OnPanEnd');
        // Place the element at the correct position
        if (this.oldPos) {
          if (this.oldPos.left) {
            // --> insert to the left
            SpanService.pushElementLeftOf(this.dragEl, this.oldPos.refEl);
          } else {
            // --> insert to the right
            SpanService.pushElementRightOf(this.dragEl, this.oldPos.refEl);
          }
        }
        // in multiWordReorder case have to delete empty spans
        if (this.isMultiWordDrag) {
          SpanService.removeEmptySpans(ReorderService.component.mainDiv.nativeElement);
        }
        // In any case, i.e. whether the element was dropped at a correct position or not, leave the dragging mode
        // 1. Remove the potential unnecessary space at the oldEl position (might be two now, or one at the beginning/end)
        SpanService.cleanSpacesAfterRemoving(this.oldEl);
        // 2. Remove the copied element which was just there s.t. the text does not jump
        if (this.oldEl.parentElement) {
          this.oldEl.parentElement.removeChild(this.oldEl);
        }
        // 3. Put it back in normal positioning
        this.dragEl.style.position = 'static';
        // 4. Remove styling from dragged element
        this.dragEl.classList.remove('dragging');
        // 5. Hide position indicator
        if (this.insertPosition) {
          this.insertPosition.style.display = 'none';
        }
        // 6. Insert probably missing spaces to the right and left
        SpanService.insertMissingSpacesAroundElement(this.dragEl);
        // 7. Reset the stored drag and drop variable
        this.oldPos = { refEl: undefined, left: false };
        // 8. Ensure the change is propagated from the view to the model, which updates the span IDs as well
        ReorderService.updateModel();
        // 9. check if we need to adapt the capitalization because the word was moved from/to the beginning
        // and update the model again, since the view's capitalization might have changed
        this.updateCapitalization();
        ReorderService.updateModel();
        // 10. Memorize that dragging process not running (otherwise we get interference from PanEnd and PressUp)
        this.dragInProgress = false;
        this.touchInProgress = false;
        // 11. high-level log
        const newText = ReorderService.component.mainDiv.nativeElement.innerText;
        if (this.oldSegmentText !== newText) {
          if (!this.isMultiWordDrag) {
            this.logService.logReorderSingle(
              this.interactionModality,
              InteractionSource.MAIN,
              this.oldSegmentText,
              newText,
              this.dragEl.innerText,
              this.oldDragPos,
              this.dragEl.id,
            );
          } else {
            this.logService.logReorderGroup(
              this.interactionModality,
              InteractionSource.MAIN,
              this.oldSegmentText,
              newText,
              SpanService.tokenizeString(this.dragEl.innerText),
              this.oldDragPos,
              'char' + ReorderService.component.mainDiv.nativeElement.innerText.toLowerCase().indexOf(this.dragEl.innerText.trim().toLowerCase()),
            );
          }
        }
        // 12. low-level log
        this.logService.logDragStop(
          this.interactionModality,
          this.dragEl.innerText,
          this.dragEl.id,
          ReorderService.component.mainDiv.nativeElement.innerText,
        );
      }
    }
  }

  /**
   * If a word was moved to/away from the beginning we might have to update the capitalization.
   */
  private updateCapitalization() {
    let nowIsSentenceBeginning = false;
    if (ReorderService.component.mainDiv.nativeElement.innerText.startsWith(this.dragEl.innerText)) {
      nowIsSentenceBeginning = true;
    }

    // Moved away from start
    if (this.dragWasSentenceBeginning && !nowIsSentenceBeginning) {
      // adapt capitalization of new start to upperCase
      const newStart: HTMLElement = $('#mainDivSpan0')[0];
      newStart.innerText = newStart.innerText[0].toUpperCase() + newStart.innerText.substring(1);
      // adapt capitalization of dragEl to lowerCase
      const firstDraggedWord: string = SpanService.tokenizeString(this.dragEl.innerText)[0];
      if (!this.capitalizationService.isNoun(firstDraggedWord)) {
        const newDragElText = this.dragEl.innerText[0].toLowerCase() + this.dragEl.innerText.substring(1);
        // update the overall string
        const mainDivText = ReorderService.component.mainDiv.nativeElement.innerText;
        ReorderService.component.mainDiv.nativeElement.innerText = mainDivText.replace(this.dragEl.innerText, newDragElText);
      }
    }

    // Moved to start
    if (!this.dragWasSentenceBeginning && nowIsSentenceBeginning) {
      // adapt capitalization of dragEl to upperCase
      const startElem = $('#mainDivSpan0')[0];
      startElem.innerText = startElem.innerText[0].toUpperCase() + startElem.innerText.substring(1);
      // adapt capitalization of old start to lowerCase
      let oldStartText = ReorderService.component.mainDiv.nativeElement.innerText.substring(this.dragEl.innerText.length).trim();
      oldStartText = SpanService.tokenizeString(oldStartText)[0];
      if (!this.capitalizationService.isNoun(oldStartText)) {
        ReorderService.component.mainDiv.nativeElement.innerText =
          ReorderService.component.mainDiv.nativeElement.innerText.substring(0, this.dragEl.innerText.length + 1) +
          oldStartText[0].toLowerCase() +
          ReorderService.component.mainDiv.nativeElement.innerText.substring(this.dragEl.innerText.length + 2);
      }
    }
  }

  /**
   * Visualize where the element would go upon drop
   * @param draggedElem - the element being dragged
   * @param touchX - the x position of the touch event
   * @param touchY - the y position of the touch event
   */
  private visualizeInsertPosition(draggedElem: HTMLElement, touchX: number, touchY: number): void {
    const elementUnderneath = CoordCalcUtils.findElementUnderneath(touchX, touchY);
    if (elementUnderneath) {
      // The below element's center
      const centerOfElUnderneathX = ReorderService.getCenterPointAbsolute(elementUnderneath)[0];
      // Place space indicator at correct position
      if (
        touchX < centerOfElUnderneathX && // it should go left
        (!this.oldPos.left || elementUnderneath !== this.oldPos.refEl) && // before it was either to right or different el
        Date.now() - this.lastActualMove > this.flickerThreshold
      ) {
        // we did not update just shortly before (avoid flickering)
        // We are above at a new position left of elementUnderneath
        // --> overwrite stored position
        this.oldPos = { refEl: elementUnderneath, left: true };
        // --> insert position indicator
        this.putArrowAtPosition(this.oldPos);
        // Update the timer so we don't reposition the position indicator all the time
        this.lastActualMove = Date.now();
        this.logService.logDragMove(
          this.interactionModality,
          draggedElem.innerText,
          elementUnderneath.id,
          ReorderService.component.mainDiv.nativeElement.innerText,
          'left',
        );
      } else if (
        touchX > centerOfElUnderneathX && // it should go right
        (this.oldPos.left || elementUnderneath !== this.oldPos.refEl) && // before it was left or different el
        Date.now() - this.lastActualMove > this.flickerThreshold
      ) {
        // we did not update just shortly before (avoid flickering)) {
        // We are above at a new position right of elementUnderneath
        // --> overwrite stored position
        this.oldPos = { refEl: elementUnderneath, left: false };
        // --> insert space indicator to the right
        this.putArrowAtPosition(this.oldPos);
        // Update the timer so we don't reposition the position indicator all the time
        this.lastActualMove = Date.now();
        this.logService.logDragMove(
          this.interactionModality,
          draggedElem.innerText,
          elementUnderneath.id,
          ReorderService.component.mainDiv.nativeElement.innerText,
          'right',
        );
      }
    }
  }

  private putArrowAtPosition(position) {
    // get position to put arrow
    let pos;
    if (position.left) {
      pos = ReorderService.getAbsolutePositionTopLeft(position.refEl);
    } else {
      pos = ReorderService.getAbsolutePositionTopRight(position.refEl);
    }

    // create arrow element
    if (!this.insertPosition) {
      $(':root').append('<div id="arrow-indicator" style="position: absolute;" class="arrow-down"></div>');
      this.insertPosition = $('#arrow-indicator')[0];
    }
    // reduce by half of arrow element's width
    pos[0] -= this.insertPosition.offsetWidth / 2;

    this.insertPosition.style.left = pos[0] + 'px';
    this.insertPosition.style.top = pos[1] + 'px';
  }
}
