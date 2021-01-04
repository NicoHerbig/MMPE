import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Project} from '../../model/project';
import {InteractionModality} from '../../model/InteractionModality';
import {TouchDistinguisher} from '../../util/touch-distinguisher';
import * as $ from 'jquery';
import {ConfigService} from "../../services/config/config.service";

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
  navbarOpen = false;
  selectedEyeTracker = 'None';
  @Input() project: Project;

  @Output() spelling = new EventEmitter<object>();
  @Output() speech = new EventEmitter<object>();
  @Output() save = new EventEmitter<InteractionModality>();
  @Output() whiteSpace = new EventEmitter<object>();
  @Output() eyeTracking = new EventEmitter<object>();
  @Output() midairGestures = new EventEmitter<object>();
  public midairGesturesRunning = false;

  constructor(private configService: ConfigService) { }

  enableSpeech: boolean = this.configService.enableSpeech;
  enableEyeTracking: boolean = this.configService.enableEyeTracking;
  enableWhiteSpace: boolean = this.configService.enableWhiteSpace;
  enableSpellcheck: boolean = this.configService.enableSpellcheck;
  enableMidairGestures: boolean = this.configService.enableMidairGestures;

  toggleNavbar() {
    this.navbarOpen = !this.navbarOpen;
  }

  onSave(event): void {
    if (event.touches) {
      // TOUCH
      event.preventDefault();
      this.save.emit(TouchDistinguisher.isPenOrFinger());
    } else {
      // MOUSE
      this.save.emit(InteractionModality.MOUSE);
    }
  }

  onSpellSwitch(event) {
    const checkbox = $('#spellcheckSwitch');
    if (event.touches) {
      // TOUCH
      event.preventDefault();
      this.spelling.emit({
        checkSpelling: !checkbox.prop('checked'),
        interactionModality: TouchDistinguisher.isPenOrFinger(),
      });
      checkbox.prop('checked', !checkbox.prop('checked'));
    } else {
      // MOUSE
      this.spelling.emit({
        checkSpelling: !checkbox.prop('checked'),
        interactionModality: InteractionModality.MOUSE,
      });
    }
  }

  onSpeechSwitch(event): void {
    const checkbox = $('#speechSwitch');
    if (event.touches) {
      // TOUCH
      event.preventDefault();
      this.speech.emit({
        speechInput: !checkbox.prop('checked'),
        interactionModality: TouchDistinguisher.isPenOrFinger(),
      });
      checkbox.prop('checked', !checkbox.prop('checked'));
    } else {
      // MOUSE
      this.speech.emit({
        speechInput: !checkbox.prop('checked'),
        interactionModality: InteractionModality.MOUSE,
      });
    }
  }

  onWhitespaceSwitch(event): void {
    const checkbox = $('#whitespaceSwitch');
    if (event.touches) {
      // TOUCH
      event.preventDefault();
      this.whiteSpace.emit({
        whiteSpaceCheck: !checkbox.prop('checked'),
        interactionModality: TouchDistinguisher.isPenOrFinger(),
      });
      checkbox.prop('checked', !checkbox.prop('checked'));
    } else {
      // MOUSE
      this.whiteSpace.emit({
        whiteSpaceCheck: !checkbox.prop('checked'),
        interactionModality: InteractionModality.MOUSE,
      });
    }
  }

  onEyetrackingDropdown(event): void {
    const eyeTrackerName = event.target.innerHTML;
    this.selectedEyeTracker = eyeTrackerName;
    if (event.touches) {
      event.preventDefault();
      this.eyeTracking.emit({eyeTracking: eyeTrackerName, interactionModality: TouchDistinguisher.isPenOrFinger()});
    } else {
      // MOUSE
      this.eyeTracking.emit({eyeTracking: eyeTrackerName, interactionModality: InteractionModality.MOUSE});
    }
  }

  onMidairGesturesSwitch(event): void {
    const checkbox = $('#midairGestures');
    if (event.touches) {
      // TOUCH
      event.preventDefault();
      this.midairGestures.emit({
        operation: 'activateDeactivate',
        midairGesturesCheck: !checkbox.prop('checked'),
        interactionModality: InteractionModality.MIDAIRGESTURES,
      });
      checkbox.prop('checked', !checkbox.prop('checked'));
      this.midairGesturesRunning = !checkbox.prop('checked');
    } else {
      // MOUSE
      this.midairGestures.emit({
        operation: 'activateDeactivate',
        midairGesturesCheck: !checkbox.prop('checked'),
        interactionModality: InteractionModality.MOUSE,
      });
      this.midairGesturesRunning = !checkbox.prop('checked');
      if (this.midairGesturesRunning) {
        this.onMidairGesturesCloseSenstivityPanel('show');
      } else {
        this.onMidairGesturesCloseSenstivityPanel('hide');
      }
    }
  }
  onMidairGesturesSenstivity(event): void {
    const elementRef = $(event.target);
    const gestureType = elementRef.attr('gesture');
    const sensitivity = elementRef.val();
    this.midairGestures.emit({
      operation: 'changeSenstivity',
      type: gestureType,
      senstivity: sensitivity,
    });
  }
  onMidairGesturesCloseSenstivityPanel(mode) {
    const panel = $('#senstivityPanel');
    if (mode === 'show') {
      panel.show('slow');
    } else {
      panel.hide('slow');
    }
  }
}
