import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import {Segment, SegmentStatus} from '../../model/segment';
import {Hotkey, HotkeysService} from 'angular2-hotkeys';
import {SupportToolsComponent} from '../support-tools/support-tools.component';
import {ProjectService} from '../../services/project/project.service';
import {ActivatedRoute} from '@angular/router';
import {Project} from '../../model/project';
import {SegmentDetailComponent} from '../segment-detail/segment-detail.component';
import {LogService} from '../../services/log/log.service';
import {InteractionModality} from '../../model/InteractionModality';
import {InteractionSource} from '../../model/InteractionSource';
import {TouchDistinguisher} from '../../util/touch-distinguisher';
import {EyetrackingService} from '../../services/eyetracking/eyetracking.service';
import * as CoordCalcUtils from '../../util/coord-calc-utils';
import {SpeechService} from '../../services/speech/speech.service';

@Component({
  selector: 'app-segments',
  templateUrl: './segments.component.html',
  styleUrls: ['./segments.component.scss']
})
export class SegmentsComponent implements OnInit, AfterViewInit {
  static fixatedElement: HTMLElement;
  static hadSourceFixation = false;
  static hadTargetFixation = false;
  static segmentsComponentWidth: number;
  static speechService: SpeechService;

  @Input() supportTools: SupportToolsComponent;
  @Input() project: Project;

  @ViewChild(SegmentDetailComponent, { static: false }) segmentDetail: SegmentDetailComponent;
  @ViewChild('selectedSegmentSection') selectedSegmentSection: ElementRef;

  @ViewChild('eyeCircleGaze') eyeCircleGaze: ElementRef;
  @ViewChild('eyeCircleFixation') eyeCircleFixation: ElementRef;
  @ViewChild('eyeCircleFixationLastSrc') eyeCircleFixationLastSrc: ElementRef;
  @ViewChild('eyeCircleFixationLastTgt') eyeCircleFixationLastTgt: ElementRef;
  public eyeTrackingRunning = false;

  @Output() dictionaryEvent = new EventEmitter<object>();

  public selectedSegment: Segment;
  dragging = false;


  constructor(private hotkeysService: HotkeysService,
              private route: ActivatedRoute,
              private projectService: ProjectService,
              private log: LogService,
              private eyetrackingService: EyetrackingService,
              private speechService: SpeechService,
              private element: ElementRef,
              private changeDetector: ChangeDetectorRef) {
    this.hotkeysService.add(new Hotkey('ctrl+return', (event: KeyboardEvent): boolean => {
      this.confirmSegment(InteractionModality.KEYBOARD);
      return false; // Prevent bubbling
    }));
  }

  static putElementAtPosition(element: ElementRef, x: number, y: number): void {
    const circleRadius = element.nativeElement.getBoundingClientRect().width / 2; // for center, not the top left
    element.nativeElement.style.left = x - circleRadius + 'px';
    element.nativeElement.style.top = y - circleRadius + 'px';
  }

  ngOnInit() {
    for (const segment of this.project.segments) {
      if (segment.segmentStatus !== SegmentStatus.Confirmed) {
        // use onSelect method to set the segment, its status and the MT
        this.onSelect(segment, null, null);
        break;
      }
    }
  }

  ngAfterViewInit() {
    const componentX = this.element.nativeElement.getBoundingClientRect().left;
    const componentY = this.element.nativeElement.getBoundingClientRect().top;
    this.eyetrackingService.registerEyeDataCallbacks(this.onEyeDataGaze, this.onEyeDataFixationStart,
      this.onEyeDataFixationEnd, this.eyeCircleGaze, this.eyeCircleFixation,
      this.eyeCircleFixationLastSrc, this.eyeCircleFixationLastTgt, componentX, componentY, this.speechService);
    SegmentsComponent.segmentsComponentWidth = this.selectedSegmentSection.nativeElement.offsetWidth;
  }

  /**
   * Defines what happens when new eye coordinates are received
   * @param x - the x coordinate, in screen space, as a percentage between 0 and 1
   * @param y - the y coordinate, in screen space, as a percentage between 0 and 1
   * @param movableElement - the element to be moved
   * @param lastSrcFixation - the HTML element to show at the last source fixation
   * @param lastTgtFixation - the HTML element to show at the last target fixation
   * @param componentOffsetX - the offset of the parent component to the start of the page in X
   * @param componentOffsetY - the offset of the parent component to the start of the page in Y
   */
  onEyeDataGaze(x: number, y: number, movableElement: ElementRef, lastSrcFixation: ElementRef,
                lastTgtFixation: ElementRef, componentOffsetX, componentOffsetY): void {
    // transform these screen coordinates to website coordinates
    const toolbarHeight = window.outerHeight - window.innerHeight; // height of the toolbar, i.e. tabs, url space, ...
    const visX = x * window.screen.width - self.screenLeft - componentOffsetX; // screenLeft/Top is browser window coordinate
    const visY = y * window.screen.height - self.screenTop - componentOffsetY - toolbarHeight + window.scrollY;
    SegmentsComponent.putElementAtPosition(movableElement, visX, visY);
    // GazeMarks approach: show last fixation on source/target
    if (visX < SegmentsComponent.segmentsComponentWidth / 2) {
      // we now look at the source side
      if (SegmentsComponent.hadTargetFixation) {
        // there was already a fixation
        lastTgtFixation.nativeElement.hidden = false; // show it
      }
    } else {
      // we now look at the target side
      if (SegmentsComponent.hadSourceFixation) {
        // there was already a fixation
        lastSrcFixation.nativeElement.hidden = false; // show it
      }
    }
  }

  /**
   * Defines what happens when new eye fixation is received
   * @param x - the x coordinate, in screen space, as a percentage between 0 and 1
   * @param y - the y coordinate, in screen space, as a percentage between 0 and 1
   * @param movableElement - the element to be moved
   * @param lastSrcFixation - the HTML element to show at the last source fixation
   * @param lastTgtFixation - the HTML element to show at the last target fixation
   * @param componentOffsetX - the offset of the parent component to the start of the page in X
   * @param componentOffsetY - the offset of the parent component to the start of the page in Y
   * @param speechService - a reference to the speech service for eye + speech multi-modal interaction
   */
  onEyeDataFixationStart(x: number, y: number, movableElement: ElementRef, lastSrcFixation: ElementRef,
                         lastTgtFixation: ElementRef, componentOffsetX, componentOffsetY,
                         speechService: SpeechService): void {
    // transform these screen coordinates to website coordinates
    const toolbarHeight = window.outerHeight - window.innerHeight; // height of the toolbar, i.e. tabs, url space, ...
    const pageX = x * window.screen.width - self.screenLeft; // screenLeft/Top is browser window coordinate
    const pageY = y * window.screen.height - self.screenTop - toolbarHeight;
    const visX = pageX - componentOffsetX;  // need to subtract the comopents' (SegmentsComponent) offset for visualization
    const visY = pageY - componentOffsetY  + window.scrollY; // and check if scrolling happened
    SegmentsComponent.putElementAtPosition(movableElement, visX, visY);
    movableElement.nativeElement.hidden = false;
    SegmentsComponent.fixatedElement = CoordCalcUtils.findElementUnderneath(pageX, pageY);
    if (SegmentsComponent.fixatedElement) {
      // highlight fixated word/gap
      SegmentsComponent.fixatedElement.classList.add('fixated');
      // inform speech service for multi-modal commands
      speechService.notifyInteraction(InteractionModality.EYETRACKING, SegmentsComponent.fixatedElement.id);
    }
    // check if fixation is in source or target, memorize last fixation there
    if (visX < SegmentsComponent.segmentsComponentWidth / 2) {
      // fixation on source
      SegmentsComponent.putElementAtPosition(lastSrcFixation, visX, visY);
      SegmentsComponent.hadSourceFixation = true;
      lastSrcFixation.nativeElement.hidden = true;
    } else {
      // fixation on target
      SegmentsComponent.putElementAtPosition(lastTgtFixation, visX, visY);
      SegmentsComponent.hadTargetFixation = true;
      lastTgtFixation.nativeElement.hidden = true;
    }
  }

  /**
   * Defines what happens when a fixation ends
   * @param timestamp - the timestamp from the eye tracker
   * @param duration - the duration of the fixation
   * @param dispersion - the dispersion of the fixation
   * @param x - the x coordinate, in screen space, as a percentage between 0 and 1
   * @param y - the y coordinate, in screen space, as a percentage between 0 and 1
   * @param movableElement - the element to be moved
   * @param componentOffsetX - the offset of the parent component to the start of the page in X
   * @param componentOffsetY - the offset of the parent component to the start of the page in Y
   * @param speechService - a reference to the speech service for eye + speech multi-modal interaction
   * @param logService - a reference to the log service to log the fixation
   */
  onEyeDataFixationEnd(timestamp: number, duration: number, dispersion: number, x: number, y: number,
                       movableElement: ElementRef, componentOffsetX, componentOffsetY,
                       speechService: SpeechService, logService: LogService): void {
    const word = SegmentsComponent.fixatedElement ? SegmentsComponent.fixatedElement.textContent : '';
    const segmentText = SegmentsComponent.fixatedElement ? SegmentsComponent.fixatedElement.parentElement.textContent : '';
    const wordPos = SegmentsComponent.fixatedElement ? 'word' + SegmentsComponent.fixatedElement.id.substr('mainDivSpan'.length) : '';
    logService.logFixation(timestamp, duration, dispersion, x, y, wordPos, word, segmentText);
    movableElement.nativeElement.hidden = true;
    if (SegmentsComponent.fixatedElement) {
      // hide highlighting of word/gap
      SegmentsComponent.fixatedElement.classList.remove('fixated');
      // forget last highlight
      SegmentsComponent.fixatedElement = null;
      // inform speech service that nothing is fixated so that it does not impact multi-modal commands
      speechService.unNotifyInteraction(InteractionModality.EYETRACKING);
    }
  }

  /*onTouchStart() {
    this.dragging = false;
  }

  onTouchMove() {
    this.dragging = true;
  }*/

  onSelect(segment: Segment, event, interactionModality): void {
    if (this.dragging) {
      return;
    }
    // update selected segment, mark it as active and update the mt
    this.selectedSegment = segment;
    this.selectedSegment.segmentStatus = SegmentStatus.Active;
    this.supportTools.updateMT(this.selectedSegment.mt);
    if (this.selectedSegment !== undefined) {
      this.log.addGeneralInformation('segmentID', this.selectedSegment.id);

      if (event === null && interactionModality === null) {
        this.log.logSegmentSelection(InteractionModality.DEFAULT, InteractionSource.UI);
      } else if (event === null && interactionModality !== null) {
        if (interactionModality === InteractionModality.KEYBOARD) {
          this.log.logSegmentSelection(interactionModality, InteractionSource.HOTKEY);
        } else {
          this.log.logSegmentSelection(interactionModality, InteractionSource.UI);
        }
      } else if (event !== null && interactionModality === null) {
        console.log(event);
        if (event.touches) {
          // TOUCH
          event.preventDefault();
          this.log.logSegmentSelection(TouchDistinguisher.isPenOrFinger(), InteractionSource.UI);
        } else {
          // MOUSE
          this.log.logSegmentSelection(InteractionModality.MOUSE, InteractionSource.UI);
        }
      } else {
        console.error('This call to onSelect should not happen!', event, interactionModality);
      }
    }
    this.changeDetector.detectChanges();
  }

  confirmSegment(interactionModality: InteractionModality) {
    const duration = Date.now() - SegmentDetailComponent.segmentTimer;
    console.log('Confirmed segment with id: ' + this.selectedSegment.id);
    this.selectedSegment.segmentStatus = SegmentStatus.Confirmed;

    let interactionSource;

    if (interactionModality === InteractionModality.KEYBOARD) {
      interactionSource = InteractionSource.HOTKEY;
    } else {
      interactionSource = InteractionSource.UI;
    }

    if (this.selectedSegment.studyOperation && this.selectedSegment.studyModality && this.selectedSegment.studyTrial
        && this.selectedSegment.studyCorrection) {
      // if we are in study mode --> pass this for logging
      this.log.logSegmentConfirmation(interactionModality, interactionSource, this.selectedSegment.target, duration,
        this.selectedSegment.studyOperation, this.selectedSegment.studyModality, this.selectedSegment.studyTrial,
        this.selectedSegment.studyCorrection);
    } else {
      // otherwise log without it
      this.log.logSegmentConfirmation(interactionModality, interactionSource, this.selectedSegment.target, duration);
    }

    this.saveSegment();

    // identify segment to show next
    const numSegments = this.project.segments.length;
    const oldSegment = this.project.segments.indexOf(this.selectedSegment);
    let index = oldSegment + 1;
    if (index >= numSegments) {
      index = 0;
    }

    while (index !== oldSegment) {
      const segment = this.project.segments[index];

      if (segment.segmentStatus !== SegmentStatus.Confirmed) {
        return this.onSelect(segment, null, interactionModality);
      }

      if (index >= numSegments - 1) {
        index = 0;
      } else {
        index++;
      }
    }

    // this code is only reached if do not have not confirmed segments anymore -> don't need a new selectedSegment
    this.selectedSegment = undefined;
  }

  saveSegment() {
    this.projectService.updateProject(this.project).subscribe(_ => console.log('Saved project'));
    this.segmentDetail.updateMidairGestureSpansArray();
  }

  onSpellcheckSwitch(useSpellcheck: boolean): void {
    this.segmentDetail.onSpellcheckSwitch(useSpellcheck);
  }

  onSpeechSwitch(useSpeech: boolean): void {
    this.segmentDetail.onSpeechSwitch(useSpeech);
  }

  onWhitespaceSwitch(useWhitespace: boolean): void {
    this.segmentDetail.onWhitespaceSwitch(useWhitespace);
  }

  onEyeTrackingSwitch(eyeTracker: string): void {
    if (eyeTracker !== 'None') {
      this.eyetrackingService.subscribeToEyeTracker(eyeTracker);
      this.eyeTrackingRunning = true;
    } else {
     this.eyetrackingService.unsubscribeFromEyeTracker();
     // reset all visuals
     SegmentsComponent.hadSourceFixation = false;
     SegmentsComponent.hadTargetFixation = false;
     this.eyeCircleFixationLastSrc.nativeElement.hidden = true;
     this.eyeCircleFixationLastTgt.nativeElement.hidden = true;
     if (SegmentsComponent.fixatedElement) {
       SegmentsComponent.fixatedElement.classList.remove('fixated');
       SegmentsComponent.fixatedElement = null;
     }
     this.eyeTrackingRunning = false;
    }
  }

  onDictionary(wordAndModality: object) {
    this.dictionaryEvent.emit(wordAndModality);
  }

  onResetMainDiv() {
    this.segmentDetail.onMainDivReset();
  }

}
