import {Injectable} from '@angular/core';
import {SegmentDetailComponent} from '../../components/segment-detail/segment-detail.component';
import {ApplicationType, UndoRedoState} from '../../model/UndoRedoState';
import {CursorSelection} from '../../model/CursorSelection';
import {SpanService} from '../span/span.service';

@Injectable({
  providedIn: 'root'
})
export class UndoRedoService {

  private undoStack: UndoRedoState[]; // contains the previous as well as the current state (top-most) of the applications
  private redoStack: UndoRedoState[]; // contains states the can be restored after an undo operation

  private component: SegmentDetailComponent;  // the observed component

  private caretInfo: CursorSelection = undefined; // to temporarily store the caretInfo for reselection after restoring a state

  constructor() {}

  /**
   * Returns true if a redo can be performed.
   */
  public isRedoPossible(): boolean {
    // possible if there is any state on the redo stack
    return this.redoStack.length > 0;
  }

  /**
   * Returns true if an undo can be performed
   */
  public isUndoPossible(): boolean {
    return this.undoStack.length > 1;
  }

  /**
   * Registers a segment to be observed, s.t. undo/redo operations can be performed
   * @param segmentDetailComponent - the component that should be observed
   */
  public registerComponent(segmentDetailComponent: SegmentDetailComponent): void {
    this.component = segmentDetailComponent;
    this.reinitializeService();
  }

  /**
   * Re-initializes the service, i.e. resets its internal state.
   */
  public reinitializeService(): void {
    if (this.component) {
      // segment has changed -> empty undo and redo stack
      this.undoStack = [];
      this.redoStack = [];

      this.undoStack.push(new UndoRedoState(ApplicationType.MAIN, this.component.selectedSegment.target, undefined));
    }
  }

  /**
   * Needs to be called if the window resizes (handwritingEditor needs to be updated
   * s.t. handwriting undo/redo functions do not work anymore)
   */
  public windowResized(): void {
    // Transform all handwriting items on undo stack to main items, since we cannot call handwritingEditor's undo after an import
    this.undoStack.forEach(item => {item.application = ApplicationType.MAIN; });
    this.redoStack.forEach(item => {item.application = ApplicationType.MAIN; });
  }

  /**
   * Adds an UndoRedoState to the undo stack
   * @param app - the type of the application that detected changes (HANDWRITING or MAIN application)
   * @param cursorSelection - the cursor selection at that point in time
   * this element.
   */
  public updateUndoRedo(app: ApplicationType, cursorSelection: CursorSelection): void {

    // check if there rly is a change or if the method is called due some callback mechanism (e.g. on resize)
    if (this.component.selectedSegment.target === this.undoStack[this.undoStack.length - 1].targetText) {
      return;
    }

    this.undoStack.push(new UndoRedoState(app, this.component.selectedSegment.target, cursorSelection));
    this.redoStack = [];
  }

  /**
   * Performs an undo operation.
   */
  public undo(): string {
    if (this.isUndoPossible()) {
      const undoState = this.undoStack.pop();
      this.redoStack.push(undoState);

      if (undoState.application === ApplicationType.HANDWRITING) { // it was a change inside handwritingEditor
        this.component.handwritingEditor.undo();
      } else { // it was a change outside of handwritingEditor
        this.component.selectedSegment.target = this.undoStack[this.undoStack.length - 1].targetText;
        this.caretInfo = this.undoStack[this.undoStack.length - 1].cursorSelection;
        // Mirror changes to Handwriting editor
        this.component.importIntoHandwritingEditor(false);
        // Transform all handwriting items on undo stack to main items, since we cannot call handwritingEditor's undo after an import
        this.undoStack.forEach(item => {item.application = ApplicationType.MAIN; });
      }

      return this.component.selectedSegment.target;
    } else {
      this.caretInfo = null;
    }
  }

  /**
   * Performs a redo operation.
   */
  public redo(): string {
    if (this.isRedoPossible()) {
      const redoState = this.redoStack.pop();
      this.undoStack.push(redoState);

      if (redoState.application === ApplicationType.HANDWRITING) { // it was a change inside handwritingEditor
        this.component.handwritingEditor.redo();
      } else { // it was a change outside of handwritingEditor
        console.log('Redoing main application state');
        this.component.selectedSegment.target = redoState.targetText;
        this.caretInfo = redoState.cursorSelection;
        // Mirror changes to Handwriting editor
        this.component.importIntoHandwritingEditor(false);
        // Transform all handwriting items on redo stack to main items, since we cannot call handwritingEditor's redo after an import
        this.redoStack.forEach(item => {item.application = ApplicationType.MAIN; });
      }
    } else {
      this.caretInfo = null;
    }

    return this.component.selectedSegment.target;
  }

  public setInitialCaretData(cursorSelection: CursorSelection) {
    this.undoStack[0].addCaretData(cursorSelection);
  }

  public restoreCaret() {
    SpanService.restoreCursorSelection(this.caretInfo);
  }
}
