import { ReorderService } from '../reorder/reorder.service';
import { LineObject } from '../../model/LineObject';
import { Injectable, OnInit } from '@angular/core';
import { LogService } from '../log/log.service';
import { SpanService } from '../span/span.service';

import * as $ from 'jquery';
import { InteractionModality } from '../../model/InteractionModality';
import { SegmentDetailComponent } from 'src/app/components/segment-detail/segment-detail.component';
import { InteractionSource } from '../../model/InteractionSource';

@Injectable({
  providedIn: 'root',
})
export class MidairGesturesService implements OnInit {
  constructor(private logService: LogService, private spanService: SpanService, private reorderService: ReorderService) {
    this.webSocket = new WebSocket(getBaseLocation());
    this.webSocket.onopen = () => {
      console.log('Connected to Leap Motion Controller on server via websocket');
    };
    this.webSocket.onclose = () => {
      console.log('Closed connection/websocket to Leap Motion Controller on server');
    };
    this.webSocket.onmessage = (msg) => {
      this.handleGesturesData(msg);
    };
  }

  private static component: SegmentDetailComponent;

  private webSocket: WebSocket;
  private xIndexPosition = 0;
  private spanLinesArray = [];
  private lineObjectsArray = [];
  private xRange = 300; // maximum x range coming from leap controller
  private yRange = 200;
  private yRangeMovement = 100;
  private xMovementRatio = 1; // movement at char level
  private yMovementRatio = 5; // movement up/down
  private yMovementStart = 100; // hand level from down
  private rightHandLineNum = 0;
  private leftHandLineNum = 0;
  private leftCaretPos = 0;
  private rightCaretPos = 0;
  private panStart = false;
  private initialPanX = 0;
  private initialPanY = 0;
  private textSelected = false;
  private cursorPos = 0;
  private cursorOldPos = 0;
  private cursorOldPosLeft = 0;
  private cursorOldPosRight = 0;
  public modelIsShown = false;

  dragEl: HTMLElement;
  public static registerComponent(segmentDetailComponent: SegmentDetailComponent): void {
    this.component = segmentDetailComponent;
  }

  ngOnInit() {
    this.setSpansArray();
    // this.touchService.bindEventsToElement(this.mainDiv.nativeElement);
  }

  ngAfterView() {}

  public subscribeToLeapMotion() {
    console.log('Telling server to subscribe to Leap Motion Controller');
    this.webSocket.send(JSON.stringify({ operation: 'subscribe' }));
  }
  public unsubscribeFromLeapMotion() {
    console.log('Telling server to unsubscribe from Leap Motion Controller');
    this.webSocket.send(JSON.stringify({ operation: 'unsubscribe' }));
  }
  public changeSenstivity(sensitivity, type) {
    console.log('Changing senstivity of ' + type + ' to ' + sensitivity);
    const data = {
      operation: 'changeSenstivity',
      type: type,
      sensitivity: sensitivity,
    };
    this.webSocket.send(JSON.stringify(data));
  }
  private handleGesturesData(msg: MessageEvent) {
    const gestureData = JSON.parse(msg.data);
    const gestureType: string = gestureData.type;
    const output = document.getElementById('gesturesOutput');
    if (!this.modelIsShown) {
      output.innerText = 'Current Gesture: ' + gestureType;
      switch (gestureType) {
        case 'moveCaret':
          this.moveCaret(gestureData);
          break;
        case 'deleteSingle':
          this.deleteSingle(gestureData);
          break;
        case 'deleteGroup':
          this.deleteGroup();
          break;
        case 'selectGroup':
          this.selectGroup(gestureData);
          break;
        case 'panStartAndMove':
          this.onPanStart(gestureData);
          break;
        case 'panEnd':
          this.onPanEnd();
          break;
        case 'confirm':
          this.confirmSegment();
          break;
        default:
          break;
      }
    } else {
      output.innerText = 'Gestures deactivated, the model is shown.';
    }
  }
  confirmSegment() {
    MidairGesturesService.component.confirmSegment(InteractionModality.MIDAIRGESTURES);
  }
  private onPanStart(gestureData) {
    const editingDiv = $('#mainDiv')[0];
    const divCoords = this.getCoords(editingDiv);
    const top = divCoords.top;
    const bottom = divCoords.bottom;
    const left = divCoords.left;
    const right = divCoords.right;

    const pos = this.getXYPanPosition(left, top, right, bottom, gestureData.indexX, gestureData.palmY);
    const eventSrcX = pos.eventSrcX;
    const eventSrcY = pos.eventSrcY;
    const posX = pos.posX;
    const posY = pos.posY;

    // check if there is selection, if so, perform reorder
    const sel = window.getSelection();
    let myEvent = {};
    if (!this.panStart) {
      // check if it comes from selection
      if (
        (sel &&
          sel.anchorNode &&
          sel.toString() !== '' &&
          sel.anchorNode.parentElement &&
          sel.anchorNode.parentElement.parentElement &&
          sel.anchorNode.parentElement.parentElement.id === 'mainDiv') ||
        (sel &&
          sel.anchorNode &&
          sel.anchorNode.parentElement &&
          sel.anchorNode.parentElement.parentElement &&
          sel.anchorNode.parentElement.nodeName === 'SPAN' &&
          sel.anchorNode.parentElement.id.startsWith('mainDivSpan'))
      ) {
        // call panStart
        const target = sel.anchorNode.parentElement as HTMLElement;
        this.panStart = true;
        myEvent = {
          gesture: {
            pointerType: 'midair',
            target,
            deltaX: 0,
            deltaY: 0,
          },
        };
        // initialize pan
        this.reorderService.onPanStart(myEvent);
        // get the element coords
        this.initialPanX = this.reorderService.dragElStartX;
        this.initialPanY = this.reorderService.dragElStartY;
        this.dragEl = this.reorderService.dragEl;
        console.log('start', myEvent, this.initialPanX, this.initialPanY, sel.anchorNode);
      }
    } else {
      // call panMove
      const deltaX = posX - this.initialPanX;
      const deltaY = posY - this.initialPanY;
      const target = document.getElementById('mainDiv');
      myEvent = {
        gesture: {
          pointerType: 'midair',
          deltaX,
          deltaY,
          srcEvent: {
            x: eventSrcX,
            y: eventSrcY,
          },
        },
        target,
      };
      this.reorderService.onPanMove(myEvent);
    }
  }
  private onPanEnd() {
    let myEvent = {};
    if (this.panStart) {
      // call panEnd
      this.panStart = false;
      myEvent = {
        gesture: {
          pointerType: 'midair',
        },
      };
      this.reorderService.onPanEnd(myEvent);
      // this.setSpansArray();
    }
  }
  private getXYPanPosition(left, top, right, bottom, indexX, palmY) {
    // X movement range && ratio
    let XmovementRatio = right - left;
    XmovementRatio = XmovementRatio / this.xRange;

    // Y movement range && ratio
    let YmovementRatio = bottom - top;
    YmovementRatio = YmovementRatio / this.yMovementStart;

    // get X, Y ranges
    const posX = indexX * XmovementRatio;
    const posY = palmY * YmovementRatio;

    // get eventSrc X, Y ranges
    let eventSrcX = left + posX;
    let eventSrcY = top - window.scrollY + posY;

    // check if X, Y in the editing div coords
    eventSrcX = eventSrcX > right ? right : eventSrcX;
    eventSrcY = eventSrcY > bottom ? bottom : eventSrcY;

    return { posX, eventSrcX, posY, eventSrcY };
  }
  private moveCaret(gestureData: { indexX: number; indexY: number; palmX: number; palmY: number }) {
    const indexX = gestureData.indexX;
    const palmY = gestureData.palmY;

    const newCaret = Math.floor(indexX / this.xMovementRatio);
    const currentCursor = SpanService.getCursorPosDiv('mainDiv');

    const editingDiv = $('#mainDiv')[0];
    editingDiv.focus();

    // initialize spans array && set movement ratio
    if (this.spanLinesArray.length === 0) {
      this.setSpansArray();
    }
    // check if there is a movement over hand palm y axis, Y range 0 - 200, 0 is bottom

    if (palmY % this.yMovementRatio === 0 && palmY <= this.yRangeMovement) {
      // console.log(palmY);
      const maxLineNumber = this.spanLinesArray.length; // e.g. 5
      const newPalmValue = this.yRangeMovement - palmY; // e.g. 120 - 90 = 30
      let newLineNumber = newPalmValue / this.yMovementRatio; // e.g. 30 / 10 = 3
      newLineNumber = maxLineNumber - newLineNumber; // e.g. 5 - 3 = 2
      newLineNumber = newLineNumber < 0 ? 0 : newLineNumber;
      const lineNum = this.setCaretVertically(newLineNumber, maxLineNumber, 'rightHand');
      // start at the same line, e.g. when selecting
      this.leftHandLineNum = this.rightHandLineNum;
      // update caret position at the new line
      this.setCaretHorizontally(newCaret, this.lineObjectsArray[lineNum]);
    }
    // check if there is a movement over x axis
    if (indexX % this.xMovementRatio === 0) {
      // set caret
      this.setCaretHorizontally(newCaret, this.lineObjectsArray[this.rightHandLineNum]);
      // store current x value from Leap Controller
      this.xIndexPosition = indexX;
    }
    // log caret movement
    if (this.cursorPos !== this.cursorOldPos) {
      this.logService.logMidairGesturesCaretMovement($('#mainDiv').text(), this.cursorPos);
    }
    this.cursorOldPos = this.cursorPos;
  }
  private setCaretHorizontally(pos: number, lineObj: LineObject) {
    const selNode = this.getNodeAndOffset(pos, lineObj);
    if (selNode != null) {
      const startOffset = selNode.offSet;
      const startNode = selNode.node;
      document.getSelection().collapse(startNode, startOffset);
    } else {
      // TODO: case no text
      console.log('No text to edit!');
    }
  }
  private getNodeAndOffset(pos: number, lineObj: LineObject) {
    let charCounter = lineObj.startPos;
    const lineLength = lineObj.endPos;
    let spanEl = lineObj.firstNode;
    pos += lineObj.startPos;
    if (pos > lineLength) {
      pos = lineLength; // maximum is the length of the line
    }
    if (pos < charCounter) {
      return null;
    }
    if (spanEl != null) {
      // there is some text in the mainDiv
      while (spanEl && charCounter + spanEl.innerText.length < pos) {
        charCounter += spanEl.innerText.length;
        spanEl = spanEl.nextSibling;
      }
      // store cursor pos
      this.cursorPos = pos;
      const startOffset = pos - charCounter;
      const startNode = spanEl.firstChild;
      const obj = { node: startNode, offSet: startOffset };
      return obj;
    } else {
      // TODO: case no text
      return null;
    }
  }
  private setCaretVertically(newLineNumber: number, maxLineNumber: number, palmType: string) {
    if (palmType === 'rightHand') {
      // check if there is no movement
      if (newLineNumber === this.rightHandLineNum) {
        // do nothing
      } else {
        // check if the new value is greater then moving down
        if (newLineNumber > this.rightHandLineNum) {
          if (this.rightHandLineNum < maxLineNumber - 1) {
            this.rightHandLineNum += 1;
          }
        } else {
          if (this.rightHandLineNum > 0) {
            this.rightHandLineNum -= 1;
          }
        }
      }
      return this.rightHandLineNum;
    }
    if (palmType === 'leftHand') {
      if (newLineNumber === this.leftHandLineNum) {
        // do nothing
      } else {
        // check if the new value is greater then moving down
        if (newLineNumber > this.leftHandLineNum) {
          // TODO: check how many lines to move instead of one line
          if (this.leftHandLineNum < maxLineNumber - 1) {
            this.leftHandLineNum += 1;
          }
        } else {
          if (this.leftHandLineNum > 0) {
            this.leftHandLineNum -= 1;
          }
        }
      }
      return this.leftHandLineNum;
    }
  }
  private async deleteSingle(gestureData: any) {
    console.log('midairGestures: deleteSingle');
    const editingDiv = document.getElementById('mainDiv');
    const currText = editingDiv.innerText;
    const oldText = editingDiv.innerText;
    let cursor = await SpanService.getCursorPosDiv('mainDiv');
    cursor = cursor.begin;
    // remove element at cursor position
    const elementText = await this.removeElement(cursor, editingDiv, oldText);

    // remove extra spaces
    SpanService.removeEmptySpans(editingDiv);
    // reinit the main div
    this.setSpansArray();
    // log service
    const newText = editingDiv.innerText;
    this.logService.logMidairGestureDeleteSingle(
      InteractionModality.MIDAIRGESTURES,
      InteractionSource.UI,
      oldText,
      newText,
      cursor.toString(),
      elementText.toString(),
    );
  }
  private async deleteGroup() {
    console.log('midairGestures: deleteGroup');
    const editingDiv = document.getElementById('mainDiv');
    const oldText = editingDiv.innerText;
    // set cursor
    let cursor = await SpanService.getCursorPosDiv('mainDiv');
    cursor = cursor.begin;

    const sel = window.getSelection();
    sel.deleteFromDocument();
    // remove extra spaces
    SpanService.removeEmptySpans(editingDiv);

    // init spans array
    this.setSpansArray();

    // log interaction
    const newText = editingDiv.innerText;
    const segmentTextOld = oldText.replace(new RegExp(String.fromCharCode(160), 'g'), ' ');
    const segmentTextNew = newText.replace(new RegExp(String.fromCharCode(160), 'g'), ' ');
    const [delWords, delPos] = LogService.getStringDifference(newText.split(' '), oldText.split(' '));
    this.logService.logMidairGestureDeleteGroup(InteractionModality.MIDAIRGESTURES, InteractionSource.UI, oldText, newText, delPos, delWords);
  }
  private selectGroup(gestureData: any) {
    // init gesture data
    const leftIndexX = gestureData.leftIndexX;
    const rightIndexX = gestureData.rightIndexX;

    const leftPalmY = gestureData.leftPalmY;
    const rightPalmY = gestureData.rightPalmY;

    const newCaretLeft = Math.floor(leftIndexX / this.xMovementRatio);
    const newCaretRight = Math.floor(rightIndexX / this.xMovementRatio);

    // initial start from the current position
    this.leftCaretPos = this.leftCaretPos === 0 ? newCaretLeft : this.leftCaretPos;
    this.rightCaretPos = this.rightCaretPos === 0 ? newCaretRight : this.rightCaretPos;

    // check if there is up/down movement over the left y axis
    if (leftPalmY % this.yMovementRatio === 0 && leftPalmY <= this.yRangeMovement) {
      const maxLineNumber = this.spanLinesArray.length; // e.g. 5
      const newPalmValue = this.yRangeMovement - leftPalmY; // e.g. 120 - 90 = 30
      let newLineNumber = newPalmValue / this.yMovementRatio; // e.g. 30 / 10 = 3
      newLineNumber = maxLineNumber - newLineNumber; // e.g. 5 - 3 = 2
      newLineNumber = newLineNumber < 0 ? 0 : newLineNumber;
      const lineNum = this.setCaretVertically(newLineNumber, maxLineNumber, 'leftHand');
      // this.leftCaretPos = newCaretLeft + this.lineObjectsArray[lineNum].startPos;
    }

    // check if there is up/down movement over the right y axis
    if (rightPalmY % this.yMovementRatio === 0 && rightPalmY <= this.yRangeMovement) {
      const maxLineNumber = this.spanLinesArray.length; // e.g. 5
      const newPalmValue = this.yRangeMovement - rightPalmY; // e.g. 120 - 90 = 30
      let newLineNumber = newPalmValue / this.yMovementRatio; // e.g. 30 / 10 = 3
      newLineNumber = maxLineNumber - newLineNumber; // e.g. 5 - 3 = 2
      newLineNumber = newLineNumber < 0 ? 0 : newLineNumber;
      const lineNum = this.setCaretVertically(newLineNumber, maxLineNumber, 'rightHand');
      // this.rightCaretPos = newCaretRight + this.lineObjectsArray[lineNum].startPos;
    }

    // get the start position - left index
    if (leftIndexX % this.xMovementRatio === 0) {
      // get caret position
      this.leftCaretPos = newCaretLeft;
    }

    // get the end position - right index
    if (rightIndexX % this.xMovementRatio === 0) {
      // get caret position
      this.rightCaretPos = newCaretRight;
    }

    const leftObj = this.getNodeAndOffset(this.leftCaretPos, this.lineObjectsArray[this.leftHandLineNum]);
    const leftPos = this.cursorPos;
    const rightObj = this.getNodeAndOffset(this.rightCaretPos, this.lineObjectsArray[this.rightHandLineNum]);
    const rightPos = this.cursorPos;
    // console.log(leftObj, rightObj);
    if (this.leftHandLineNum <= this.rightHandLineNum) {
      this.setTextSelection(leftObj, rightObj);
    } else {
      this.setTextSelection(rightObj, leftObj);
    }
    // log changes
    if (this.cursorOldPosLeft !== leftPos || this.cursorOldPosRight !== rightPos) {
      const segmentText = $('#mainDiv').text();
      const selectedText = window.getSelection().toString();
      this.logService.logMidairGesturesSelection(segmentText, leftPos, rightPos, selectedText);
    }
    this.cursorOldPosLeft = leftPos;
    this.cursorOldPosRight = rightPos;
  }
  private setTextSelection(startEl, endEl) {
    if (startEl === null || endEl === null) {
      return 0;
    }
    const startNode = startEl.node;
    const startOffset = startEl.offSet;
    const endNode = endEl.node;
    const endOffset = endEl.offSet;
    const doc = window.document;
    if (window.getSelection && doc.createRange) {
      const sel = window.getSelection();
      const range = doc.createRange();
      try {
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (error) {
        console.log(error, startNode, startOffset, endNode, endOffset);
      }
    }
  }
  private removeElement(pos, editingDiv, oldText) {
    let charCounter = 0;
    let spanEl = editingDiv.firstChild;
    if (spanEl != null) {
      // there is some text in the mainDiv
      while (charCounter + spanEl.innerText.length < pos) {
        charCounter += spanEl.innerText.length;
        if (spanEl.nextSibling != null) {
          spanEl = spanEl.nextSibling;
        } else {
          break;
        }
      }
      const nextChild = spanEl.nextSibling;
      // remove the element
      const spanText = $(spanEl).text();
      // select the element before deleting it
      this.selectElementContents(spanEl);
      const wait = (delay, ...args) => new Promise((resolve) => setTimeout(resolve, delay, ...args));
      return wait(250).then(() => {
        spanEl.remove();
        if (nextChild && nextChild.className !== 'whitespace') {
          nextChild.remove();
        }
        return spanText;
      });
    }
  }
  private selectElementContents(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  private getCoords(elem) {
    let box = elem.getBoundingClientRect();
    return {
      top: Math.floor(box.top + window.pageYOffset),
      right: Math.floor(box.right + window.pageXOffset),
      bottom: Math.floor(box.bottom + window.pageYOffset),
      left: Math.floor(box.left + window.pageXOffset),
    };
  }
  public setSpansArray() {
    this.spanLinesArray = [];
    this.lineObjectsArray = [];
    let spansInSameLine = [];
    const mainDivEl = $('#mainDiv')[0];
    let child = mainDivEl.firstChild;
    let i = 0;
    while (child) {
      let childTopOffset = this.getCoords(child).top;
      let nextChild = child.nextSibling;
      spansInSameLine.push(child);
      child = nextChild;
      if (!nextChild) {
        this.spanLinesArray[i] = spansInSameLine;
      } else {
        let nextChildTopOffset = this.getCoords(nextChild).top;
        if (Math.abs(childTopOffset - nextChildTopOffset) > 10) {
          this.spanLinesArray[i] = spansInSameLine;
          spansInSameLine = [];
          i++;
        }
      }
    }
    // set the objects array
    let charCounter = 0;
    let startPos = 0;
    let lineCounter = 0;

    this.spanLinesArray.forEach((line) => {
      const lineLength = line.length;
      const firstNode = line[0];
      const lastNode = line[lineLength - 1];

      charCounter += this.getLineLength(line);
      const LineObj = { lineNumber: lineCounter, startPos, endPos: charCounter, firstNode, lastNode };
      this.lineObjectsArray[lineCounter] = LineObj;
      // update for next line
      startPos = charCounter;
      lineCounter++;
    });
    console.log('Span lines objects: ', this.lineObjectsArray);
    // set movement ratio
    this.setMovementRate();
  }
  private getLongestLine() {
    let longestLine = 0;
    let wordsNumber = 0;
    // loop the outer array
    for (const spans of this.spanLinesArray) {
      // get the size of the inner array
      let charCounter = 0;
      // loop the inner array
      for (const span of spans) {
        charCounter += span.innerText.length;
      }
      wordsNumber = spans.length > wordsNumber ? spans.length : wordsNumber;
      longestLine = charCounter > longestLine ? charCounter : longestLine;
    }
    return { longestLine, wordsNumber };
  }
  private setMovementRate() {
    // moving at char level
    const numbers = this.getLongestLine();
    const ratio = Math.floor(this.xRange / numbers.longestLine);
    this.xMovementRatio = ratio;
    // moving at word level
  }
  private getLineLength(currentLineSpans) {
    let charCounter = 0;
    // loop the outer array
    for (const span of currentLineSpans) {
      // get the size of the inner array
      charCounter += span.innerText.length;
    }
    return charCounter;
  }
}

function getBaseLocation() {
  let url = window.location.href;
  let arr = url.split("/");
  let path = ":3000";
  let protocol: string;
  if (arr[0] == "https:") {
    protocol = "wss:";
  } else {
    protocol = "ws:";
  }
  let result = protocol + "//" + arr[2].split(":")[0];
  result = result + path + "/midairGestures/getData";
  return result;
}
