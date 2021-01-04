import {Component, HostListener, Input, OnInit, ViewChild} from '@angular/core';
import {ProjectService} from '../../services/project/project.service';
import {Project} from '../../model/project';
import {ActivatedRoute} from '@angular/router';
import {SegmentsComponent} from '../segments/segments.component';
import {SupportToolsComponent} from '../support-tools/support-tools.component';
import {LogService} from '../../services/log/log.service';
import {InteractionSource} from '../../model/InteractionSource';
import {TouchDistinguisher} from '../../util/touch-distinguisher';
import {InteractionModality} from '../../model/InteractionModality';
import {SpeechService} from '../../services/speech/speech.service';
import {SegmentDetailComponent} from '../segment-detail/segment-detail.component';

@Component({
  selector: "app-editing-page",
  templateUrl: "./editing-page.component.html",
  styleUrls: ["./editing-page.component.scss"],
})
export class EditingPageComponent implements OnInit {

  @Input() project: Project;

  @ViewChild(SegmentsComponent, { static: false }) segments: SegmentsComponent;
  @ViewChild(SupportToolsComponent, { static: false }) supportTools: SupportToolsComponent;

  private doubleClick: boolean;
  private dragStart;

  private lastMouseMove = 0;

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e) {
    const curTS = Date.now();
    if (this.lastMouseMove + 10 > curTS) {
      TouchDistinguisher.LAST_MOUSE_MOVE_TS = curTS;
    }
    this.lastMouseMove = curTS;
  }

  constructor(
    private projectService: ProjectService,
    private route: ActivatedRoute,
    private log: LogService,
    private speechService: SpeechService
  ) {}

  ngOnInit() {
    this.getProject();
  }

  getProject(): void {
    const id = +this.route.snapshot.paramMap.get('id');
    this.projectService.getProject(id)
      .subscribe(project => {
        this.project = project;
        this.log.addGeneralInformation('participant', project.projectid);
      } );
  }

  onSpellcheckSwitch(useSpellcheckInteactionType: object): void {
    if (useSpellcheckInteactionType['checkSpelling']) {
      this.log.logSpellcheckActivation(useSpellcheckInteactionType['interactionModality']);
    } else {
      this.log.logSpellcheckDeactivation(useSpellcheckInteactionType['interactionModality']);
    }

    this.segments.onSpellcheckSwitch(useSpellcheckInteactionType['checkSpelling']);
  }

  onSpeechSwitch(useSpeechInteactionType: object): void {
    if (useSpeechInteactionType['speechInput']) {
      this.log.logSpeechActivation(useSpeechInteactionType['interactionModality']);
    } else {
      this.log.logSpeechDeactivation(useSpeechInteactionType['interactionModality']);
    }

    this.segments.onSpeechSwitch(useSpeechInteactionType['speechInput']);
  }

  onWhitespaceSwitch(useWhitespaceInteractionType: object): void {
    if (useWhitespaceInteractionType['whiteSpaceCheck']) {
      this.log.logWhitespacecheckActivation(useWhitespaceInteractionType['interactionModality']);
    } else {
      this.log.logWhitespacecheckDeactivation(useWhitespaceInteractionType['interactionModality']);
    }
    // need to add the part for visualization in div
    this.segments.onWhitespaceSwitch(useWhitespaceInteractionType['whiteSpaceCheck']);
  }

  onEyeTrackingSwitch(useEyeTrackingInteractionType: object): void {
    const switchActivated = useEyeTrackingInteractionType['eyeTracking'] !== 'None';
    if (switchActivated) {
      this.log.logEyeTrackingActivation(useEyeTrackingInteractionType['interactionModality']);
    } else {
      this.log.logEyeTrackingDeactivation(useEyeTrackingInteractionType['interactionModality']);
    }
    // need to add the part for visualization in div
    this.segments.onEyeTrackingSwitch(useEyeTrackingInteractionType['eyeTracking']);
  }

  onMidairGesturesOperations(useMidairGesturesInteractionType: object): void {
    const operation = useMidairGesturesInteractionType["operation"];
    if (operation === "activateDeactivate") {
      const switchActivated =
        useMidairGesturesInteractionType["midairGesturesCheck"];
      if (switchActivated) {
        this.log.logMidairGesturesActivation(
          useMidairGesturesInteractionType["interactionModality"]
        );
      } else {
        this.log.logMidairGesturesDeactivation(
          useMidairGesturesInteractionType["interactionModality"]
        );
      }
      // need to add the part for visualization in div
      this.segments.segmentDetail.onMidairGesturesTrackingSwitch(switchActivated);
    } else if (operation === "changeSenstivity") {
      // tslint:disable-next-line: max-line-length
      this.segments.segmentDetail.onMidairGesturesSenstivityChange(
        useMidairGesturesInteractionType["senstivity"],
        useMidairGesturesInteractionType["type"]
      );
    } else {
      // default do nothing
    }
  }

  onDictionary(wordAndModality: object) {
    this.supportTools.updateDictionaryInformation(wordAndModality);
  }

  onMainDivReset(interactionModality: InteractionModality) {
    this.log.logTranslationReset(interactionModality);
    this.segments.onResetMainDiv();
  }

  onSave(interactionModality: InteractionModality): void {
    this.projectService.updateProject(this.project).subscribe((r) => {
      alert('Saved Project.');
    });

    this.log.logSave(this.segments.selectedSegment.target, interactionModality);
  }

  getClickInfo(event) {
    const coordinates = {
      x: event.pageX / window.innerWidth,
      y: event.pageY / window.innerHeight
    };

    // drag and not a single click
    if (this.hasDragged(coordinates)) {
      return;
    }

    let modality: InteractionModality = null;

    if (event.sourceCapabilities && event.sourceCapabilities.firesTouchEvents) {
      modality = TouchDistinguisher.isPenOrFinger();
    } else {
      modality = InteractionModality.MOUSE;
    }

    let target = event.nodeName;
    if (event.target.id !== '') {
      target = event.target.id;
    }

    let interactionSource = InteractionSource.UNKNOWN;
    if (document.activeElement.id === 'mainDiv') {
      interactionSource = InteractionSource.MAIN;
    } else if (target === 'editor') {
      interactionSource = InteractionSource.HANDWRITING;
    }

    return { coordinates, modality, target, interactionSource };
  }

  @HostListener('click', ['$event'])
  onClick(event) {
    this.doubleClick = false;
    const clickInfo = this.getClickInfo(event);
    if (clickInfo !== undefined) {
      setTimeout(() => {
        if (!this.doubleClick) {
          this.log.logMouseClick(
            clickInfo.interactionSource,
            clickInfo.modality,
            event.buttons,
            clickInfo.target,
            clickInfo.coordinates
          );
          if (clickInfo.interactionSource === InteractionSource.MAIN) {
            this.speechService.notifyInteraction(
              clickInfo.modality,
              clickInfo.target
            );
          } else {
            this.speechService.unNotifyInteraction(clickInfo.modality);
          }
        }
      }, 500);
    }
  }
  @HostListener('dblclick', ['$event'])
  onDblClick(event) {
    this.doubleClick = true;
    const clickInfo = this.getClickInfo(event);
    if(clickInfo !== undefined) {
      this.log.logMouseDoubleClick(
        clickInfo.interactionSource,
        clickInfo.modality,
        event.buttons,
        clickInfo.target,
        clickInfo.coordinates
      );
    }
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event) {
    this.dragStart = {
      x: event.pageX / window.innerWidth,
      y: event.pageY / window.innerHeight
    };
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(event) {
    const up = {
      x: event.pageX / window.innerWidth,
      y: event.pageY / window.innerHeight
    };

    let target = event.nodeName;
    if (event.target.id !== '') {
      target = event.target.id;
    }

    let interactionSource = InteractionSource.UNKNOWN;
    if (document.activeElement.id === 'mainDiv') {
      interactionSource = InteractionSource.MAIN;
    } else if (target === 'editor') {
      interactionSource = InteractionSource.HANDWRITING;
    }

    if (this.hasDragged(up)) {
      this.log.logMouseDrag(interactionSource, this.dragStart, up, target);
      SegmentDetailComponent.dragStartFlag = true;
    }
  }

  private hasDragged(up) {
    return up['x'] !== this.dragStart['x'] || up['y'] !== this.dragStart['y'];
  }
}
