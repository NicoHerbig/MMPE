import {MidairGesturesService} from '../../services/midair-gestures/midair-gestures.service';
import {ReorderService} from '../../services/reorder/reorder.service';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChange,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from '@angular/material/dialog';
import {Segment} from '../../model/segment';
import {Hotkey, HotkeysService} from 'angular2-hotkeys';
import * as MyScriptJS from 'myscript/dist/myscript.min.js';
import * as $ from 'jquery';
import {SpellcheckService} from '../../services/spellcheck/spellcheck.service';
import {SpanService} from '../../services/span/span.service';
import {debounceTime, distinctUntilChanged} from 'rxjs/operators';
import {Observable, Subscription} from 'rxjs';
import {UndoRedoService} from '../../services/undo-redo/undo-redo.service';
import {ApplicationType} from '../../model/UndoRedoState';
import {TouchService} from '../../services/touch/touch.service';
import {LogService} from '../../services/log/log.service';
import {SpeechService} from '../../services/speech/speech.service';
import {InteractionModality} from '../../model/InteractionModality';
import {InteractionSource} from '../../model/InteractionSource';
import {TouchDistinguisher} from '../../util/touch-distinguisher';
import * as CoordCalcUtils from '../../util/coord-calc-utils';
import {ConfigService} from '../../services/config/config.service';

class HeightAndWidth {
  height: number;
  width: number;
}

export interface StudyDialogData {
  operation: string;
  source: string;
  mt: string;
  correction: string;
  modality: string;
  trial: boolean;
}

@Component({
  selector: 'app-study-dialog',
  templateUrl: 'study-dialog-qe.html'  // choose which dialog to display here
})
export class StudyDialogComponent {

  constructor(
    public dialogRef: MatDialogRef<StudyDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StudyDialogData) {
  }

  public onCloseConfirm(event) {
    this.dialogRef.close($('input[name=likert]:checked').val());
  }
}

export interface FinalDialogData {
  segmentNo: string;
}

@Component({
  selector: 'final-dialog',
  templateUrl: 'final-dialog.html'
})
export class FinalDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<FinalDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FinalDialogData) {
  }

  public onCloseConfirm(event) {
    this.dialogRef.close($('input[name=visualization]:checked').val());
  }
}

@Component({
  encapsulation: ViewEncapsulation.None,
  selector: 'app-segment-detail',
  templateUrl: './segment-detail.component.html',
  styleUrls: ['./segment-detail.component.scss']
})
export class SegmentDetailComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {

  constructor(private hotkeysService: HotkeysService, private spellchecker: SpellcheckService,
              public undoRedoService: UndoRedoService, private spanService: SpanService,
              private logService: LogService, private speechService: SpeechService,
              private touchService: TouchService, public dialog: MatDialog, private configService: ConfigService,
              private midairGesturesService: MidairGesturesService) {

    this.hotkeysService.add(new Hotkey('ctrl+z', (event: KeyboardEvent): boolean => {
      this.onUndo(false, event);
      return false; // Prevent bubbling
    }));

    this.hotkeysService.add(new Hotkey('ctrl+y', (event: KeyboardEvent): boolean => {
      this.onRedo(false, event);
      return false; // Prevent bubbling
    }));

    this.hotkeysService.add(new Hotkey('ctrl+c', (event: KeyboardEvent): boolean => {
      this.copyKeyboard = true;
      return false; // Prevent bubbling
    }));

    this.hotkeysService.add(new Hotkey('ctrl+v', (event: KeyboardEvent): boolean => {
      this.pasteKeyboard = true;
      return false; // Prevent bubbling
    }));

    this.hotkeysService.add(new Hotkey('ctrl+x', (event: KeyboardEvent): boolean => {
      this.cutKeyboard = true;
      return false; // Prevent bubbling
    }));
  }

  // Fields for HTML template
  public enableSpeech: boolean = this.configService.enableSpeech;
  public enableHandwriting: boolean = this.configService.enableHandwriting;
  public enableTouchMode: boolean = this.configService.enableTouchMode;
  // Fields for logging
  public static segmentTimer: number;
  public static dragStartFlag = false;
  public static qualityEstimates;
  public static colors;
  public static initialColors;
  public static segmentNumber = 1;
  public static mode;
  public static confirmFlag = false;
  public static blockNumber = 0;

  private copyKeyboard = false;
  private pasteKeyboard = false;
  private cutKeyboard = false;
  private cutFlag = false;
  private newSegmentText = '';
  private oldSegmentText = '';
  private interactionType;
  private interactionSource;
  private segmentChangedFlag = false;
  private clipboardContent = '';

  // Fields for drag and drop

  private dragDropFlag = false;
  private oldSegmentBeforeDrop = '';
  private oldCursorPosBeforeDrop = '';
  private newCursorPosAfterDrop = '';
  private newSegmentAfterDrop = '';
  private dragDropDivChangeCount = 0;

  // Field to check for changes
  private previousMainDivTextContent;

  // Check if in typing phase
  private startTypingFlag = false;

  // Memorize if key was pressed already
  private firstKey = true;

  // Fields to detect hotkeys
  private controlPressed = false;

  // Was segment confirm initialized
  private confirmSegmentFlag = false;

  // A reference to pop-up dialog for studies
  private dialogRef: MatDialogRef<StudyDialogComponent, any>;

  // Memorize editing mode (normal or handwriting
  public handwritingMode = false;

  // Variables required to make handwriting work
  private handwritingActivated = false; // if handwriting was ever used yet
  private leftButtonDown = false; // to add a hook on left button press while writing
  public handwritingEditor;
  private handwritingEditorLogTimeout = null;
  private handwritingEditorStoredOldText = null;
  private handwritingEditorInteractionModality: InteractionModality = null;
  private changesToIgnoreForHandwritingEditorExport = 0;
  private lastMainDivChange = null;

  // Variables for speech input
  public speechCommand = '';
  public speechFeedback = '';

  // Variables to memorize which of the things in the navbar are running
  public midairGesturesRunning = false;
  public checkSpelling = false;
  public whiteSpace = false;

  // To run a function when stopping typing
  private typingTimeout = null;
  qualityEstimation = this.configService.enableQualityEstimation;
  @Input() selectedSegment: Segment;
  @Output() confirmSegmentEvent = new EventEmitter<InteractionModality>();
  @Output() saveSegmentEvent = new EventEmitter<string>();
  @Output() dictionaryEvent = new EventEmitter<object>();
  @ViewChild('handwritingDiv', {read: ElementRef, static: true}) handwritingDiv: ElementRef;

  // For detecting height changes of contenteditable div
  private subscription: Subscription;
  @ViewChild('mainDiv', {static: true}) mainDiv: ElementRef;

  private static getIndicesOf(searchStr: string, str: string, caseSensitive: boolean): any {
    str = str.replace(new RegExp(String.fromCharCode(160), 'g'), ' ');
    searchStr = searchStr.replace(new RegExp(String.fromCharCode(160), 'g'), ' ');
    const searchStrLen = searchStr.length;
    if (searchStrLen === 0) {
      return [];
    }
    let startIndex = 0;
    let index = 0;
    const indices = [];
    if (!caseSensitive) {
      str = str.toLowerCase();
      searchStr = searchStr.toLowerCase();
    }
    while (str.indexOf(searchStr, startIndex) > -1) {
      index = str.indexOf(searchStr, startIndex);
      indices.push(index);
      startIndex = index + searchStrLen;
    }
    return indices;
  }

  ngOnInit() {
    TouchService.registerComponent(this);
    SpeechService.registerComponent(this);
    ReorderService.registerComponent(this);
    MidairGesturesService.registerComponent(this);
    this.undoRedoService.registerComponent(this);
    this.updateSourceView(this.selectedSegment.source);
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  ngAfterViewInit(): void {
    this.touchService.bindEventsToElement(this.mainDiv.nativeElement);
    console.log(this.selectedSegment.target);

    // Add a hook for pen input on that field, because for logging we need to know when the last input happened
    // needs happen for touchmove, which is both PEN and Finger touch
    this.handwritingDiv.nativeElement.addEventListener('touchmove', (evt) => {
      // console.log('called from touchmove');
      this.handwritingEditorInteractionModality = TouchDistinguisher.isPenOrFinger();
      this.logHandwritingEditorChange(null, this.selectedSegment.target); // also set during exported event
    });

    // set up speech recognition
    this.speechService.callIbmSpeechClient();
    this.mainDiv.nativeElement.textContent = this.selectedSegment.target;
    const mainDiv = $('#mainDiv');
    SpanService.initDomElement(this.selectedSegment.target, mainDiv, false);
    this.checkSelectedSegmentSpelling();

    SegmentDetailComponent.segmentTimer = Date.now(); // set start timer

    this.realignSourceView();

    // if the text is from study mode, show dialog with correction to apply
    this.openStudyDialogIfNecessary();
  }

  setUpHandwriting(): void {
    this.handwritingEditor = MyScriptJS.register(this.handwritingDiv.nativeElement, {
      recognitionParams: {
        type: 'TEXT',
        protocol: 'WEBSOCKET',
        apiVersion: 'V4',
        server: {
          scheme: 'https',
          host: 'webdemoapi.myscript.com',
          applicationKey: this.configService.myScriptApplicationKey,
          hmacKey: this.configService.myScriptHmacKey
        },
        v4: {
          lang: this.configService.myScriptLanguage,
          text: {
            guides: {
              enable: true
            },
            smartGuide: true,
            smartGuideFadeOut: {
              enable: false,
              duration: 1000
            }// ,
            // margin: {
            //  top: 10 // unfortunately this is the margin on top of the smart guide, not between smart guide and text
            // }
          }
        }
      }
    });
    // Set font of handwritingEditor
    this.handwritingEditor.theme = {'.text': {'font-size': 11, 'line-height': 1.4}}; // should be in sync with scss file variables

    // Import the segment's current target text
    this.importIntoHandwritingEditor(true);

    // reload myscript handwritingEditor when contenteditable div changes height
    this.setupHeightMutationObserver();

    // Add export hook to put data in selectedSegment
    this.handwritingDiv.nativeElement.addEventListener('exported', (evt) => {
      // console.log('Exported called handwritingEditor');
      // Call change on handwritingEditor
      this.handwritingEditorChanged(evt);
      // Fix bug in smartguide where candidates are always spawned in nirvana...
      $('.smartguide').on('click', (x) => {
        // console.log('Smartguide clicked.');
        const candidates = $('.candidates');
        const candiWidth = '-' + candidates.width() + 'px';
        candidates.css({left: 'auto', right: candiWidth});
      });
    });

    // Memorize if left mouse button is pressed. Otherwise we cannot detect writing with mouse in handwritingDiv
    $(document).mousedown((evt) => {
      // Left mouse button was pressed, set flag
      if (evt.which === 1) {
        this.leftButtonDown = true;
      }
    });
    $(document).mouseup((evt) => {
      // Left mouse button was released, clear flag
      if (evt.which === 1) {
        this.leftButtonDown = false;
      }
    });

    // Add a hook for pen input on that field, because for logging we need to know when the last input happened
    // needs to work for mousemove, but mousemove also happens when no button is pressed, so we need to check this
    this.handwritingDiv.nativeElement.addEventListener('mousemove', (evt) => {
      if (evt.which === 1 && this.leftButtonDown) {
        // console.log('called from mousemove');
        this.handwritingEditorInteractionModality = InteractionModality.MOUSE;
        this.logHandwritingEditorChange(null, this.selectedSegment.target); // also set during exported event
      }
    });
  }

  realignSourceView(): void {
    const segmentDetailComponent = $('#segment-detail-component')[0] as HTMLElement;
    if (!this.handwritingMode) {
      // realign source view to mainDiv
      const checkExist = setInterval(() => {
        // need to ensure everything finished loading
        if (this.mainDiv.nativeElement.offsetTop) {
          clearInterval(checkExist);
          console.log('MainDiv exists');
          const sourceTop: number = CoordCalcUtils.getTopDifference(this.mainDiv.nativeElement, segmentDetailComponent);
          $('#sourceView').css({top: sourceTop.toString() + 'px'});
        }
      }, 50); // check every 50ms
    } else {
      // realign source view to handwriting view
      const checkExist = setInterval(() => {
        // need to ensure everything finished loading
        const handwritingParentDiv = $('#handwritingParentDiv');
        const textInHandwritingEditor = $('#MODEL-viewTransform');
        if (handwritingParentDiv.length && handwritingParentDiv[0].offsetTop && textInHandwritingEditor.length) {
          clearInterval(checkExist);
          console.log('HandwritingDiv exists', textInHandwritingEditor);
          const textInHandwritingBBox: DOMRect = (textInHandwritingEditor[0] as HTMLElement).getBoundingClientRect();
          const sourceTop: number = CoordCalcUtils.getTopDifferenceDOMRect(textInHandwritingBBox, segmentDetailComponent);
          $('#sourceView').css({top: sourceTop.toString() + 'px'});
        }
      }, 50); // check every 50ms
    }
  }

  openStudyDialogIfNecessary(): void {
    if (this.selectedSegment.studyCorrection !== undefined || this.selectedSegment.mode !== undefined) {
      console.log('opening dialog');
      // stop while pop up model is shown
      this.midairGesturesService.modelIsShown = true;
      this.dialogRef = this.dialog.open(StudyDialogComponent, {
        width: '1000px',
        data: {
          operation: this.selectedSegment.studyOperation,
          source: this.selectedSegment.source,
          mt: this.selectedSegment.mt,
          correction: this.selectedSegment.studyCorrection,
          modality: this.selectedSegment.studyModality,
          trial: this.selectedSegment.studyTrial
        }
      });
      this.dialogRef.afterClosed().subscribe((result) => {
        SegmentDetailComponent.segmentTimer = Date.now();
        this.midairGesturesService.modelIsShown = false;
        console.log('The dialog was closed');
        this.logService.logUserFeedback(this.selectedSegment.id - 1, result);
      });
    }
  }

  public openFinalDialogIfNecessary(): void {
    if (this.selectedSegment.mode !== undefined) {
      const dialogRef = this.dialog.open(FinalDialogComponent, {
        width: '1000px',
        data: {
          segmentNo: SegmentDetailComponent.blockNumber,
        }
      });

      dialogRef.afterClosed().subscribe(result => {
        SegmentDetailComponent.segmentTimer = Date.now();
      });
    }
  }

  // Detect when the segment-detail component is handling another segment (e.g. after confirming, or simply by manually changing)
  ngOnChanges(changes: SimpleChanges) {
    this.firstKey = true;
    const segmentChange: SimpleChange = changes.selectedSegment;
    this.updateSourceView(segmentChange.currentValue.source);
    this.updateModel(segmentChange.currentValue.target, true, true, false, true);
    // Reset UI elements on switching the segment.
    document.getElementById('warning').innerHTML = '';
    document.getElementById('microphone').innerHTML = '';
    this.scrollIntoViewIfNeeded();
    SegmentDetailComponent.segmentTimer = Date.now(); // reset start timer
    this.openStudyDialogIfNecessary();
    this.changesToIgnoreForHandwritingEditorExport += 1;

    this.resizeHandwritingView();
    this.realignSourceView();

    // initialize midairgestures for next segement
    this.updateMidairGestureSpansArray();
  }

  scrollIntoViewIfNeeded() {
    // to also show some surrounding context, scroll to the element before if needed
    const segment3Before = $('#segment' + Math.max(this.selectedSegment.id - 3, 0))[0];
    if (segment3Before) {
      segment3Before.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }

  checkSelectedSegmentSpelling(): void {
    SpellcheckService.unmark('#mainDiv');

    if (!this.checkSpelling) {
      return;
    }

    this.spellchecker.checkSpelling(this.selectedSegment.target).subscribe((misspellings) => {
      if (misspellings !== undefined) {
        SpellcheckService.mark('#mainDiv', misspellings);
      }
    });
  }

  /**
   * Imports the current model's text into the handwritingEditor. Also ensures that exports triggered by imports are ignored.
   * @param fullRecreate - if the method is called due to a full recreate, i.e. the whole segment changed
   */
  importIntoHandwritingEditor(fullRecreate: boolean): void {
    if (!fullRecreate) {
      this.changesToIgnoreForHandwritingEditorExport += 2; // since the change method is called twice afterwards
    }
    if (this.selectedSegment.target.trim() === '') {
      if (this.handwritingEditor !== undefined) {
        this.handwritingEditor.clear();
      }
    } else {
      if (this.handwritingActivated) {
        this.handwritingEditor.import_(this.selectedSegment.target, 'text/plain');
      }
    }
  }

  handwritingEditorChanged(event): void {
    const exports = event.detail.exports;
    if (
      this.changesToIgnoreForHandwritingEditorExport === 0 && // amount of changes we have to ignore since they come from main div
      this.lastMainDivChange &&
      Date.now() - this.lastMainDivChange > 200 && // sometimes there is an additional fake handwritingEditor change right after
      exports &&
      exports['text/plain'] !== undefined
    ) {
      if (this.selectedSegment.target !== exports['text/plain']) {
        const oldSegmentText = this.selectedSegment.target;
        this.updateModel(exports['text/plain'], false, true, false);
        // log handwritingEditor change
        console.log('called from exported');
        this.logHandwritingEditorChange(oldSegmentText, this.selectedSegment.target);
      } else {
        console.log('handwritingEditor content didnt change');
      }
    } else {
      console.log('handwritingEditor just from mainDiv');
      this.lastMainDivChange = Date.now();
    }

    // Reduce changes to ignore
    this.changesToIgnoreForHandwritingEditorExport = Math.max(this.changesToIgnoreForHandwritingEditorExport - 1, 0);
    if ((Date.now() - this.lastMainDivChange) < 200 && this.changesToIgnoreForHandwritingEditorExport === 0) {
      // means we did an import before
      // console.log('Importing finished into handwritingEditor');
    }
  }

  logHandwritingEditorChange(oldText: string, newText: string) {
    // this function is reset on exported and on pen move
    if (!this.handwritingEditorStoredOldText && oldText !== null) {
      this.handwritingEditorStoredOldText = oldText;
    }
    // Clear the timeout if it has already been set. This will prevent the previous task from executing
    // if it has been less than <MILLISECONDS>
    clearTimeout(this.handwritingEditorLogTimeout);

    // Make a new timeout set to go off in <MILLISECONDS>ms
    if (this.handwritingEditorStoredOldText !== null) {
      this.handwritingEditorLogTimeout = setTimeout((x) => {
        this.logService.logHandwritingInput(this.handwritingEditorStoredOldText, newText, this.handwritingEditorInteractionModality);
        this.handwritingEditorStoredOldText = null;
      }, 500);
    }
  }

  callcommand() {
    const baseURL = getBaseLocation();
    const getCommandsJson = baseURL + '/getCommandsJSON';
    const getSynonymJson = baseURL + '/getSynonymsJSON';
    this.speechService.command(getCommandsJson, getSynonymJson);
  }

  mainDivInput(event): void {
    SpanService.storeCursorSelection();

    // Clear the timeout if it has already been set. This will prevent the previous task from executing
    // if it has been less than <MILLISECONDS>
    clearTimeout(this.typingTimeout);

    // Make a new timeout set to go off in <MILLISECONDS>ms
    this.typingTimeout = setTimeout((x) => {
      this.updateModel(event.target.innerText, true, false, true);
      /* Code to generate high-level text logs (Insert(Group, Single), Delete(Group, Single) and ReplacePartial)*/
      // tslint:disable-next-line:max-line-length
      if (this.copyKeyboard === true) {
        this.copyKeyboard = false;
      } else if (this.confirmSegmentFlag === true) {
        this.confirmSegmentFlag = false;
      } else {
        // To prevent spurious delete logs
        if (this.segmentChangedFlag === true) {
          this.segmentChangedFlag = false;
          let position = this.logService.generateHighLevelTextLog(this.oldSegmentText, this.newSegmentText, InteractionModality.KEYBOARD, InteractionSource.MAIN);
          if (position !== undefined) {
            let labelColor = [];
            //On replace partial the word edited changes to BLACK.
            if (LogService.replaceFlag === true) {
              LogService.replaceFlag = false;
              for (let i = 0; i < position.length; i++) {
                SegmentDetailComponent.colors[position[i]] = 'NEUTRAL'
              }
            } else if (LogService.replaceMultipleFlag === true) {
              LogService.replaceMultipleFlag = false;
              for (let i = 0; i < +position[0] - 1; i++) {
                labelColor[i] = SegmentDetailComponent.colors[i];
              }
              for (let i = 0; i < LogService.replaceSelect[0]; i++) {
                labelColor[+position[i] - 1] = 'NEUTRAL';
                if (i === LogService.replaceSelect[0] - 1) {
                  labelColor[+position[0] - 1 + i] = 'NEUTRAL';
                }
              }
              let z = 0;
              for (let j = +position[0] - 1 + position.length; j < SegmentDetailComponent.colors.length; j++) {
                labelColor[+position[0] - 1 + LogService.replaceSelect[0] + z] = SegmentDetailComponent.colors[j];
                z += 1;
              }

              SegmentDetailComponent.colors = labelColor;
              LogService.replaceSelect = [];
            } else if (LogService.replaceSelect.length > 0) {
              for (let i = 0; i < +position[0]; i++) {
                labelColor[i] = SegmentDetailComponent.colors[i];
              }
              for (let i = 0; i < LogService.replaceSelect[0]; i++) {
                labelColor[+position[i]] = 'NEUTRAL';
                if (i === LogService.replaceSelect[0] - 1) {
                  labelColor[+position[0] + i] = 'NEUTRAL';
                }
              }
              let z = 0;
              for (let j = +position[0] + position.length; j < SegmentDetailComponent.colors.length; j++) {
                labelColor[+position[0] + LogService.replaceSelect[0] + z] = SegmentDetailComponent.colors[j];
                z += 1;
              }

              SegmentDetailComponent.colors = labelColor;
              LogService.replaceSelect = [];

            } else if (LogService.deleteWord === true) {
              LogService.deleteWord = false;
              // Delete group
              if (position.length > 1) {
                SegmentDetailComponent.colors.splice(+position[0], position.length);
              } else { // Delete Single
                SegmentDetailComponent.colors.splice(+position, 1);
              }
            } else {
              if (position[0] !== undefined) {
                // The first position in the insert array is taken into consideration. Till that first position, all the quality estimates are copied.
                for (var i = 0; i < position[0]; i++) {
                  labelColor[i] = SegmentDetailComponent.colors[i];
                }
                // Here i will be equal to position[0]
                let startPosition = i;
                // The positions where the words were inserted need to be changed to black.
                for (let j = 0; j < position.length; j++) {
                  labelColor[position[j]] = 'NEUTRAL';
                }
                // The second loop will take rest of the quality estimates from qualityEstimates array and populate it in labelColor array.
                let count = 1;
                if (LogService.insertFlag === true) {
                  LogService.insertFlag = false;
                  for (var i = startPosition + 1; i < SegmentDetailComponent.colors.length; i++) {
                    labelColor[+position[position.length - 1] + count] = SegmentDetailComponent.colors[i];
                    count += 1;
                  }
                } else {
                  for (var i = startPosition; i < SegmentDetailComponent.colors.length; i++) {
                    labelColor[+position[position.length - 1] + count] = SegmentDetailComponent.colors[i]
                    count += 1;
                  }
                }
                // Finally, assign the labelColor array to qualityEstimates
                SegmentDetailComponent.colors = labelColor;
              }
            }
            this.selectedSegment.qualityLabels = SegmentDetailComponent.colors;
          }
        }
      }

      this.logService.logTypingFinished(this.mainDiv.nativeElement.textContent);
      this.startTypingFlag = false;
    }, 1000);
  }

  public deleteSelectionFromButton(event) {
    if (event.touches) {
      // TOUCH
      event.preventDefault();
      this.deleteSelection(TouchDistinguisher.isPenOrFinger());
    } else {
      // MOUSE
      this.deleteSelection(InteractionModality.MOUSE);
    }
  }

  private deleteSelection(interactionModality: InteractionModality) {
    // memorize cursor position
    SpanService.storeCursorSelection();
    // do the deletion
    const sel = window.getSelection();
    sel.deleteFromDocument();
    // Restore the cursor position, but use start for end as well as range is gone
    SpanService.cursorSelection.endChar = SpanService.cursorSelection.startChar;
    SpanService.restoreCursorSelection();
    // Log delete events generated by clicking the delete button
    this.logService.generateHighLevelTextLog(
      this.selectedSegment.target,
      this.mainDiv.nativeElement.innerText,
      interactionModality,
      InteractionSource.MAIN,
    );
    this.updateModel(this.mainDiv.nativeElement.innerText, true, false, true);
  }

  public canDelete(): boolean {
    // only if something is selected
    return window.getSelection().focusOffset === window.getSelection().anchorOffset;
  }

  /**
   * Updates the data model (selectedSegment.target), undo/redo, syncs changes into the two tabs, saves,
   * and spellchecks
   * @param newTargetText - the updated text that should be placed in selectedSegment
   * @param updateHandwritingEditor - whether to import the text into the handwritingEditor
   * @param updateMain - if this and updateHandwritingEditor are both true a full recreate happens
   * @param restoreCursor - whether to restore the cursor or not
   * @param ifExecute - Optional parameter. Set to true in ngOnChanges and MainDivReset
   */
  public updateModel(newTargetText: string, updateHandwritingEditor: boolean, updateMain: boolean,
                     restoreCursor: boolean, ifExecute?: boolean, resetFlag?) {

    // get text cursor info before updating the mainDiv in order to position it correctly after the update
    SpanService.storeCursorSelection();

    // Update the model itself
    this.previousMainDivTextContent = this.selectedSegment.target;
    this.selectedSegment.target = newTargetText;

    // Potentially update the handwritingEditor
    if (updateHandwritingEditor && !updateMain) {
      this.importIntoHandwritingEditor(false);
    } else if (updateHandwritingEditor && updateMain) {
      this.importIntoHandwritingEditor(true);
    }

    // Update the mainDiv and respan if the new content is different from the old content.
    if (ifExecute === true || this.previousMainDivTextContent !== this.selectedSegment.target) {
      const mainDiv = $('#mainDiv');
      if (this.qualityEstimation) {
        if (resetFlag === true) {
          this.selectedSegment.qualityLabels = SegmentDetailComponent.initialColors;
          SpanService.initDomElement(this.selectedSegment.target, mainDiv, false, this.selectedSegment.colorLabels, SegmentDetailComponent.mode);
          console.log('Initial colors', SegmentDetailComponent.initialColors);
          resetFlag = false;
        } else {
          this.selectedSegment.qualityLabels = []
          this.selectedSegment.qualityLabels = SegmentDetailComponent.colors.slice();
          SpanService.initDomElement(this.selectedSegment.target, mainDiv, false, this.selectedSegment.qualityLabels, SegmentDetailComponent.mode);
        }
      } else {
        SpanService.initDomElement(this.selectedSegment.target, mainDiv, false);
      }
    }

    // If the whiteSpace flag is set, add background style for the new content.
    if (this.whiteSpace) {
      $('.whitespace').css('background', 'radial-gradient(circle, #000000, rgba(192,192,0,0) 5px)');
    }
    // restore the text cursor so the user does not notice that we changed the underlying spans
    if (restoreCursor) {
      SpanService.restoreCursorSelection();
    }

    // Undo Redo Stuff
    if (updateHandwritingEditor && updateMain) {
      this.undoRedoService.reinitializeService();
    } else if (updateHandwritingEditor && !updateMain) {
      // it was a main div change
      this.undoRedoService.updateUndoRedo(ApplicationType.MAIN, SpanService.cursorSelection);
    } else if (!updateHandwritingEditor && updateMain) {
      // it was a handwritingEditor change
      this.undoRedoService.updateUndoRedo(ApplicationType.HANDWRITING, SpanService.cursorSelection);
    }

    // Store the project
    this.saveSegment();

    // Spell Check if enabled
    this.checkSelectedSegmentSpelling();
  }

  /**
   * Updates the left panel (source view)
   * @param newText - the text that should be displayed
   */
  updateSourceView(newText): void {
    console.log('updating source');
    const srcView = $('#sourceView');
    srcView.empty();
    SpanService.initDomElement(this.selectedSegment.source, srcView, true);
  }

  confirmSegmentFromButton(event): void {
    if (event.touches) {
      // TOUCH
      event.preventDefault();
      this.confirmSegment(TouchDistinguisher.isPenOrFinger());
    } else if (event['speech'] === true) {
      this.confirmSegment(InteractionModality.SPEECH);
    } else {
      // MOUSE
      this.confirmSegment(InteractionModality.MOUSE);
    }
    this.confirmSegmentFlag = true;
  }

  confirmSegment(modality: InteractionModality): void {
    this.confirmSegmentEvent.emit(modality);
    if (this.selectedSegment.id === 32) {
      this.openFinalDialogIfNecessary();
    }
    this.openStudyDialogIfNecessary();//}
    SegmentDetailComponent.confirmFlag = true;
  }

  // When the window size changes
  @HostListener('window:resize', ['$event'])
  onResize(ev): void {
    // have to call resize on the handwritingEditor such that it can adapt
    // console.log('RESIZE');
    this.undoRedoService.windowResized();
    if (this.handwritingEditor) {
      this.handwritingEditor.resize();
    }
  }

  @HostListener('copy', ['$event'])
  onCopy(event) {
    this.clipboardContent = window.getSelection().toString();
    let interactionType;
    let interactionSource;
    if (this.copyKeyboard) {
      interactionType = InteractionModality.KEYBOARD;
      interactionSource = InteractionSource.HOTKEY;
    } else {
      interactionType = InteractionModality.MOUSE;
      interactionSource = InteractionSource.CONTEXT_MENU;
    }

    this.logService.logCopy(interactionType, interactionSource, this.selectedSegment.target, this.clipboardContent);
  }

  @HostListener('paste', ['$event'])
  onPaste(event) {
    let interactionType;
    let interactionSource;
    if (this.pasteKeyboard) {
      interactionType = InteractionModality.KEYBOARD;
      interactionSource = InteractionSource.HOTKEY;
    } else {
      interactionType = InteractionModality.MOUSE;
      interactionSource = InteractionSource.CONTEXT_MENU;
    }
  }

  @HostListener('cut', ['$event'])
  onCut(event) {
    this.clipboardContent = window.getSelection().toString();
    if (this.cutKeyboard) {
      this.interactionType = InteractionModality.KEYBOARD;
      this.interactionSource = InteractionSource.HOTKEY;
    } else {
      this.interactionType = InteractionModality.MOUSE;
      this.interactionSource = InteractionSource.CONTEXT_MENU;
    }
    this.cutFlag = true;
    this.cutKeyboard = false;
  }

  // When the height changes because the height of the neighboring contenteditable div has changed
  setupHeightMutationObserver(): void {
    const observerable$ = new Observable<HeightAndWidth>((observer) => {
      // Callback function to execute when mutations are observed
      // this can and will be called very often
      const callback = (mutationsList, observer2) => {
        this.handwritingEditor.resize();
      };
      // Create an observer instance linked to the callback function
      const elementObserver = new MutationObserver(callback);

      // Options for the observer (which mutations to observe)
      const config = {attributes: true, childList: true, subtree: true};
      // Start observing the target node for configured mutations
      elementObserver.observe(this.mainDiv.nativeElement, config);
    });

    this.subscription = observerable$
      .pipe(
        debounceTime(50), // wait until 50 milliseconds have lapsed since the observable was last sent
        distinctUntilChanged() // if the value hasn't changed, don't continue
      )
      .subscribe((newValues) => {
        this.handwritingEditor.resize();
      });
  }

  saveSegment(): void {
    this.saveSegmentEvent.emit('saveSegment');
    this.updateMidairGestureSpansArray();
  }

  public onMidairGesturesTrackingSwitch(useMidairGesturesTracking: boolean): void {
    if (useMidairGesturesTracking) {
      this.midairGesturesService.subscribeToLeapMotion();
    } else {
      this.midairGesturesService.unsubscribeFromLeapMotion();
    }
    this.midairGesturesRunning = useMidairGesturesTracking;
  }

  public onMidairGesturesSenstivityChange(senstivity: number, type: string) {
    this.midairGesturesService.changeSenstivity(senstivity, type);
  }

  public updateMidairGestureSpansArray() {
    if (this.midairGesturesRunning) {
      this.midairGesturesService.setSpansArray();
      console.log('Updated Midair Gestures: ', this.midairGesturesRunning);
    }
  }

  /**
   * (de-)activates the spell checking
   * called if a user enables/disables the spellcheck switch in the navbar
   * @param useSpellcheck - should be true if the user likes his input to be checked.
   */
  onSpellcheckSwitch(useSpellcheck: boolean): void {
    this.checkSpelling = useSpellcheck;
    this.checkSelectedSegmentSpelling();
  }

  /**
   * (de-)activates the whitespace visualization
   * called if a user enables/disables the useWhitespace switch in the navbar
   * @param useWhitespace - should be true if the user likes his input to be visualized.
   */
  onWhitespaceSwitch(useWhitespace: boolean): void {
    this.whiteSpace = useWhitespace;

    if (useWhitespace) {
      $('.whitespace').css('background', 'radial-gradient(circle, #000000, rgba(192,192,0,0) 5px)');
    } else {
      $('.whitespace').css('background', 'none');
    }
  }

  /**
   * By default this is the view.
   * @param event - the click event
   */
  mainView(event): void {
    this.handwritingMode = false;
    this.realignSourceView();

    // log
    if (event.touches) {
      // TOUCH
      event.preventDefault();
      this.logService.logMainViewActivation(TouchDistinguisher.isPenOrFinger());
    } else {
      // MOUSE
      this.logService.logMainViewActivation(InteractionModality.MOUSE);
    }
  }

  resizeHandwritingView(): void {
    // Set height to sourceView height + some more space
    const mainDivHeight = $('#sourceView').css('height').toString();
    const heightForHandwriting = parseInt(mainDivHeight, 10) + 200;
    $('#handwritingDiv').css({height: heightForHandwriting + 'px'});
  }

  /**
   * On activating handwriting view.
   * @param event - the click event
   */
  handwritingView(event): void {
    this.handwritingMode = true;

    this.resizeHandwritingView();

    if (!this.handwritingActivated) {
      // Set up handwriting when activated for the first time
      this.handwritingActivated = true;
      this.setUpHandwriting();
      // always resize which refreshes the handwritingEditor's alignment
      // this.handwritingEditor.resize();
    }

    this.realignSourceView();

    // log
    if (event.touches) {
      // TOUCH
      event.preventDefault();
      this.logService.logHandwritingViewActivation(TouchDistinguisher.isPenOrFinger());
    } else {
      // MOUSE
      this.logService.logHandwritingViewActivation(InteractionModality.MOUSE);
    }
  }

  /**
   * (de-)activates the speech recognition
   * called if a user enables/disables the speech switch in the navbar
   * @param useSpeech - should be true if the user likes his speech to be recognized.
   */
  onSpeechSwitch(useSpeech: boolean): void {
    this.speechService.enableDisableSpeech(useSpeech);
  }

  /**
   * Called if the 'redo' button is pressed.
   */
  onRedo(ui: boolean, event) {
    const mDiv = $('#mainDiv');
    const previousState = mDiv[0].textContent;
    if (this.undoRedoService.redo() !== mDiv[0].textContent) {
      SpanService.initDomElement(this.selectedSegment.target, mDiv, false);
      this.undoRedoService.restoreCaret();
    }
    const updatedState = mDiv[0].textContent;
    if (!ui) {
      this.logService.logRedo(InteractionModality.KEYBOARD, InteractionSource.HOTKEY, previousState, updatedState);
    } else {
      if (event.touches) {
        // TOUCH
        event.preventDefault();
        this.logService.logRedo(TouchDistinguisher.isPenOrFinger(), InteractionSource.UI, previousState, updatedState);
      } else {
        // MOUSE
        this.logService.logRedo(InteractionModality.MOUSE, InteractionSource.UI, previousState, updatedState);
      }
    }
    this.saveSegment();
  }

  /**
   * Called if the 'undo' button is pressed.
   */
  onUndo(ui: boolean, event) {
    const mDiv = $('#mainDiv');
    const previousState = mDiv[0].textContent;
    if (this.undoRedoService.undo() !== mDiv[0].textContent) {
      SpanService.initDomElement(this.selectedSegment.target, mDiv, false);
      this.undoRedoService.restoreCaret();
    }

    const updatedState = mDiv[0].textContent;
    // Undo via speech logged
    if (!ui && event['speech'] === true) {
      this.logService.logUndo(InteractionModality.SPEECH, InteractionSource.MICROPHONE, previousState, updatedState);
    } else if (!ui) {
      this.logService.logUndo(InteractionModality.KEYBOARD, InteractionSource.HOTKEY, previousState, updatedState);
    } else {
      if (event.touches) {
        // TOUCH
        event.preventDefault();
        this.logService.logUndo(TouchDistinguisher.isPenOrFinger(), InteractionSource.UI, previousState, updatedState);
      } else {
        // MOUSE
        this.logService.logUndo(InteractionModality.MOUSE, InteractionSource.UI, previousState, updatedState);
      }
    }
    this.saveSegment();
  }

  /**
   * Event handler: user clicks a word in the left panel (source)
   * @param event - the clicked word
   */
  onSourceViewClick(event) {
    if (event.touches) {
      // TOUCH
      event.preventDefault();
      this.dictionaryEvent.emit({
        sourceWord: event.target.innerText,
        interactionModality: TouchDistinguisher.isPenOrFinger()
      });
    } else {
      // MOUSE
      this.dictionaryEvent.emit({sourceWord: event.target.innerText, interactionModality: InteractionModality.MOUSE});
    }
  }

  /**
   * Called if the 'reset' button is pressed.
   */
  onMainDivReset() {
    this.updateModel(this.selectedSegment.mt, true, false, false, true, true);
  }

  mainDivChange(event) {
    SpanService.storeCursorSelection();
    // If one wants to log reordered output after dragging and dropping the word(s).
    if (this.dragDropFlag === true) {
      this.dragDropDivChangeCount += 1;
      if (this.dragDropDivChangeCount === 2) {
        this.newSegmentAfterDrop = this.mainDiv.nativeElement.textContent;
        // tslint:disable-next-line:max-line-length
        const oldIndices = SegmentDetailComponent.getIndicesOf(window.getSelection().toString(), this.oldSegmentBeforeDrop, true);
        const rightOldIndex = oldIndices.indexOf(+this.oldCursorPosBeforeDrop);
        // Get the substring of the old segment before re-order.
        const characterPosString = this.oldSegmentBeforeDrop.substring(0, +this.oldCursorPosBeforeDrop);
        // Tokenize the above obtained substring
        const wordPos = SpanService.tokenizeString(characterPosString).filter((word) => word !== ' ');
        // tslint:disable-next-line:max-line-length
        const newIndices = SegmentDetailComponent.getIndicesOf(window.getSelection().toString(), this.newSegmentAfterDrop, true);
        this.newCursorPosAfterDrop = newIndices[+rightOldIndex];
        // Get the substring of the new segment before re-order.
        const characterPosStringNew = this.newSegmentAfterDrop.substring(0, +this.newCursorPosAfterDrop);
        // Tokenize the above obtained substring
        const wordPosNew = SpanService.tokenizeString(characterPosStringNew).filter((word) => word !== ' ');

        this.dragDropFlag = false;
        this.dragDropDivChangeCount = 0;
        let partial = false;
        const tokens = SpanService.tokenizeString(this.oldSegmentBeforeDrop).filter(word => word !== ' ');
        const selectedWord = SpanService.tokenizeString(window.getSelection().toString()).filter(word => word !== ' ');
        // tslint:disable-next-line:prefer-for-of
        for (let j = 0; j < selectedWord.length; j++) {
          // tslint:disable-next-line:prefer-for-of
          for (let i = 0; i < tokens.length; i++) {
            if (selectedWord[j] === tokens[i]) {
              partial = false;
            } else if (tokens[i].includes(selectedWord[j])) {
              partial = true;
            }
          }
        }
        if (selectedWord.length === 1) {
          if (partial === true) {
            // tslint:disable-next-line:max-line-length
            this.logService.logReorderPartial(InteractionModality.KEYBOARD, InteractionSource.MAIN, this.oldSegmentBeforeDrop, this.newSegmentAfterDrop, window.getSelection().toString(), 'word' + (wordPos.length + 1).toString(), 'word' + (wordPosNew.length + 1).toString());
          } else {
            // tslint:disable-next-line:max-line-length
            this.logService.logReorderSingle(InteractionModality.KEYBOARD, InteractionSource.MAIN, this.oldSegmentBeforeDrop, this.newSegmentAfterDrop, window.getSelection().toString(), 'word' + (wordPos.length + 1).toString(), 'word' + (wordPosNew.length + 1).toString());
          }
          this.oldCursorPosBeforeDrop = this.newCursorPosAfterDrop;
          SpanService.storeCursorSelection();
          this.updateModel(this.newSegmentAfterDrop, true, false, false);
        } else {
          this.logService.logReorderGroup(
            InteractionModality.KEYBOARD,
            InteractionSource.MAIN,
            this.oldSegmentBeforeDrop,
            this.newSegmentAfterDrop,
            SpanService.tokenizeString(window.getSelection().toString()),
            'word' + (wordPos.length + 1).toString(),
            'word' + (wordPosNew.length + 1).toString(),
          );
          this.oldCursorPosBeforeDrop = this.newCursorPosAfterDrop;
          SpanService.storeCursorSelection();
          this.updateModel(this.newSegmentAfterDrop, true, false, false);
        }
      }
    } else {
      // If one wants to log insert (Single/Group), Delete(Single/Group), Cut and replace partial
      this.segmentChangedFlag = true;
      this.newSegmentText = this.mainDiv.nativeElement.textContent;
      if (this.cutFlag === true) {
        this.logService.logCut(this.interactionType, this.interactionSource, this.oldSegmentText, this.newSegmentText, this.clipboardContent);
        this.cutFlag = false;
      } else if (this.pasteKeyboard === true) {
        this.logService.logPaste(this.interactionType, this.interactionSource, this.oldSegmentText, this.newSegmentText, this.clipboardContent);
        this.pasteKeyboard = false;
      }

      // tslint:disable-next-line:max-line-length
      // console.log('NEWSEGMENT', this.newSegmentText);
      // console.log('OLDSEGMENT', this.oldSegmentText);
    }
  }

  onDrop(event) {
    const data = event.dataTransfer.getData('text');
    this.dragDropFlag = true;
    SpanService.storeCursorSelection();
    this.oldSegmentBeforeDrop = this.mainDiv.nativeElement.textContent;
    if (SegmentDetailComponent.dragStartFlag === true) {
      SegmentDetailComponent.dragStartFlag = false;
      this.oldCursorPosBeforeDrop = SpanService.cursorSelection.startChar.toString();
    }
  }

  onKeydown(event) {
    const key = 'key';

    if (event[key] === 'Control') {
      this.controlPressed = true;
    }

    if (this.controlPressed && event[key] === 'z') {
      this.onUndo(false, event);
      return;
    }

    if (this.controlPressed && event[key] === 'y') {
      this.onRedo(false, event);
      return;
    }
    if (this.controlPressed && event[key] === 'x') {
      this.cutKeyboard = true;
      return;
    }

    if (this.controlPressed && event[key] === 'c') {
      this.copyKeyboard = true;
      return;
    }

    if (this.controlPressed && event[key] === 'v') {
      this.pasteKeyboard = true;
      return;
    }

    if (this.controlPressed && event[key] === 'Enter') {
      this.confirmSegmentFlag = true;
      this.confirmSegment(InteractionModality.KEYBOARD);
      return;
    }

    // else log the key input
    SpanService.storeCursorSelection();
    this.logService.storeKeyEventForLogging(event[key], this.mainDiv.nativeElement.textContent, SpanService.cursorSelection);
    if (this.startTypingFlag === false) {
      this.oldSegmentText = this.mainDiv.nativeElement.textContent;
      this.startTypingFlag = true;
    }
  }

  onKeyup(event) {
    const key = 'key';
    if (event[key] === 'Control') {
      this.controlPressed = false;
    }
  }

  onInput() {
    if (this.firstKey) {
      // get text cursor info for initial undoRedoState
      SpanService.storeCursorSelection();
      this.undoRedoService.setInitialCaretData(SpanService.cursorSelection);
      this.firstKey = false;
    }
  }
}

export function getBaseLocation() {
  let url = window.location.href;
  let arr = url.split("/");
  let path = ":3000";
  let result = arr[0] + "//" + arr[2].split(":")[0];
  result = result + path + "/ibmSpeech";
  return result;
}

