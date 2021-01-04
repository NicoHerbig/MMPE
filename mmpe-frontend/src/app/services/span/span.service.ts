import { Injectable } from '@angular/core';
import * as $ from 'jquery';
import {CursorSelection} from '../../model/CursorSelection';

enum SpanType {
  word = 0,
  separator = 1,
  space = 2,
  none = 3
}

@Injectable({
  providedIn: 'root'
})
export class SpanService {

  private static wordSeparators: string[] = [',', '.', ':', ';', '!', '"', '§', '$', '%', '&', '(', ')', '=', '?',
    '{', '[', ']', '}', '\\', '#', '+', '*', '~', '€', '_', '|', '/', '<', '>'];

  public static cursorSelection: CursorSelection;
  public static caretStore = 0;
  public static selectionLength = 0;
  public static startInsertIndex = -1;
  public static endInsertIndex = -1;
  public static startDeleteIndex = -1;
  public static endDeleteIndex = -1;
  constructor() {}

  /**
   * Pushes element elToPutIn left of refElement.
   * @param elToPutIn - the element to insert
   * @param refElement - the element it should be inserted left of
   */
  public static pushElementLeftOf(elToPutIn: HTMLElement, refElement: HTMLElement): void {
    $(refElement).before(elToPutIn);
  }

  /**
   * Pushes element elToPutIn right of refElement.
   * @param elToPutIn - the element to insert
   * @param refElement - the element it should be inserted right of
   */
  public static pushElementRightOf(elToPutIn: HTMLElement, refElement: HTMLElement): void {
    $(refElement).after(elToPutIn);
  }

  /**
   * Gives both neighboring siblings of an element, both to the left and right.
   * @param ofElem - the element to get the siblings of.
   * @return a tuple, where position 0 is the sibling to the left and position 1 is the sibling to the right.
   * These might not exist.
   */
  public static getPrevAndNextEl(ofElem: HTMLElement): [HTMLElement, HTMLElement] {
    const prevEl = $(ofElem).prev()[0];
    const nextEl = $(ofElem).next()[0];
    return [prevEl, nextEl];
  }

  /**
   * The given element will be removed, so we have to ensure that its neighboring spaces are correct when it is gone.
   * @param ofElem - the element that will be removed, thereby potentially messing up the spaces around it.
   */
  public static cleanSpacesAfterRemoving(ofElem: HTMLElement): void {
    const [prevEl, nextEl] = this.getPrevAndNextEl(ofElem);

    const prevElType: SpanType = this.getSpanType(prevEl);
    const nextElType: SpanType = this.getSpanType(nextEl);

    // there are two spaces, or a space before punctuation, or a space at the end --> remove space
    if (prevElType === SpanType.space &&
      (nextElType === SpanType.separator || nextElType === SpanType.space || nextElType === SpanType.none)) {
      prevEl.remove();
    }
    // it was at the beginning and now there is only a space at the beginning
    if (prevElType === SpanType.none && nextElType === SpanType.space) {
      nextEl.remove(); // remove the space at the start
    }
  }

  /**
   * Checks the elements to the left and right of el and inserts a space-span if necessary.
   * @param el - the element to check the neighborhood of.
   */
  public static insertMissingSpacesAroundElement(el: HTMLElement): void {
    const [prevEl, nextEl] = this.getPrevAndNextEl(el);

    const elType: SpanType = this.getSpanType(el);
    const prevElType: SpanType = this.getSpanType(prevEl);
    const nextElType: SpanType = this.getSpanType(nextEl);

    if ((prevElType === SpanType.word || prevElType === SpanType.separator) && elType === SpanType.word) {
      $(prevEl).after('<span> </span>');
    }

    if ((elType === SpanType.word || elType === SpanType.separator) && nextElType === SpanType.word) {
      $(nextEl).before('<span> </span>');
    }
  }

  /**
   * Gets the type of a span by analyzing its content.
   * @param span - the span to analyze
   */
  private static getSpanType(span: HTMLElement): SpanType {
    if (!span) {
      return SpanType.none;
    } else if (!/\S/.test(span.textContent)) {
      return SpanType.space;
    } else if (this.wordSeparators.includes(span.textContent)) {
      return SpanType.separator;
    } else {
      return SpanType.word;
    }
  }

  /**
   * Numbers each span ID, which is a child of the given parent
   * @param parent - the parent of the spans that should be numbered
   */
  private static resetSpanIDs(parent: HTMLElement): void {
    const spans = $(parent).children('span');
    let id = 0;
    for (const span of spans) {
      $(span).attr('id', parent[0].id + 'Span' + id);
      id++;
    }
  }

  /**
   * Removes all spans from the element.
   * @param domElement - the domElement to remove all spans from
   */
  private static clearDomElement(domElement): void {
    for (const element of domElement.find('span')) {
      element.remove();
    }

    if (domElement[0] !== null) {
      domElement[0].innerText = '';
    }
  }

  /**
   * Uses the predefined list of wordSeparators to split the string into tokens.
   * @param input - the input string that should be tokenized.
   */
  public static tokenizeString(input: string): string[] {
    const result: string[] = [];
    let wordBuffer = '';

    for (let i = 0; i < input.length; i++) {
      let currentChar = input.charAt(i);

      // replace '\n' by spaces
      if (input.charAt(i) === '\n') {
        currentChar = ' ';
      }

      // it is a separating char
      if (SpanService.wordSeparators.includes(currentChar) || currentChar === ' ' || currentChar.charCodeAt(0) === 160) {
        if (wordBuffer.length > 0) {
          // we already have a word that is finished
          result.push(wordBuffer);
          wordBuffer = '';
        }
        result.push(currentChar);
      } else {
        // it is not a separating character
        wordBuffer += currentChar; // build up the current word
      }

      // we are at the end of the text and still have stuff on the open list
      if (i === input.length - 1 && wordBuffer.length > 0) {
        result.push(wordBuffer);
      }
    }

    return result;
  }

  /**
   * Removes empty spans if they exist, or extra spaces.
   * @param mainDiv - the element whose children might be empty spans.
   */
  public static removeEmptySpans(mainDiv: HTMLElement): void {
    let next: HTMLElement = mainDiv.firstChild as HTMLElement;
    while (next) {
      const current = next;
      next = current.nextSibling as HTMLElement;
      // remove empty spans
      if (current.innerText === '') {
        current.remove();
      }
      // remove extra spaces
      if (current.innerText === ' ') {
        const previous = current.previousSibling as HTMLElement;
        if (next && next.innerText === ' ') {
          current.remove();
        }
        if (previous && previous.innerText === ' ') {
          current.remove();
        }
      }
    }
  }

  /**
   * Save the cursor selection in a field variable to restore it later.
   * Does so on mainDiv character level instead of span level, as the spans can change.
   */
  public static storeCursorSelection(): void {
    const sel = window.getSelection();
    if (sel.toString().length > 0) {
        this.selectionLength = sel.toString().length;
    }
    // Get anchorNode and focusNode, determine which one comes before the other
    // (this depends on backwards or forwards selection, we want focusedElStart to be the one earlier in the text)
    let anchorNode = sel && sel.anchorNode ? (sel.anchorNode as HTMLElement) : undefined;
    if (anchorNode && anchorNode.id !== 'mainDiv') {
      anchorNode = anchorNode.parentElement;
    }
    let focusNode = sel && sel.focusNode ? (sel.focusNode as HTMLElement) : undefined;
    if (focusNode && focusNode.id !== 'mainDiv') {
      focusNode = focusNode.parentElement;
    }
    let focusedElStart;
    if (anchorNode && !focusNode) {
      focusedElStart = anchorNode;
    } else if (focusNode && !anchorNode) {
      focusedElStart = focusNode;
    } else if (anchorNode && focusNode) {
      // both exist, which one is earlier?
      let prevSibling: HTMLElement = anchorNode.previousSibling as HTMLElement;
      focusedElStart = anchorNode; // initialize to anchorNode
      while (prevSibling) {
        if (prevSibling === focusNode) {
          // focusNode left of anchorNode --> use focusNode
          focusedElStart = focusNode;
          break;
        } else {
          prevSibling = prevSibling.previousSibling as HTMLElement;
        }
      }
    }

    // Special case if mainDiv is selected because it was empty
    // it can then be empty (before typing), or full (after typing)
    if (focusedElStart && focusedElStart.tagName.toLowerCase() === 'div') {
      // we have the mainDiv
      let text: string = focusedElStart.innerText;
      text = text.replace('\n', '');
      if (text.length === 0) { // empty main Div
        this.cursorSelection = { startChar: 0, endChar: 0 };
      } else { // full main Div (after deletion there was an immediate writing)
        const range = sel.getRangeAt(0);
        this.cursorSelection = { startChar: range.startOffset, endChar: range.endOffset };
      }
    }

    // Actual code to get start and end char in the standard case that spans exist
    if (focusedElStart && focusedElStart.tagName.toLowerCase() === 'span') {
      const caretOffset = sel.getRangeAt(0).startOffset;
      let prevSibling: HTMLElement = focusedElStart.previousSibling as HTMLElement;
      let charCountStart = caretOffset;
      let multipleSelectionFlag = false;
      while (prevSibling) {
        // On copy-paste prevSibling.innerText is undefined. Added if-else to take care of that.
        if (prevSibling.innerText !== undefined) {
          charCountStart += prevSibling.innerText.length;
          prevSibling = prevSibling.previousSibling as HTMLElement;
        } else {
          charCountStart = this.caretStore;
          multipleSelectionFlag = true;
          break;
        }
      }

      let charCountEnd = charCountStart + sel.toString().length;
      if (charCountStart === charCountEnd) {
        this.caretStore = charCountEnd;
        if (multipleSelectionFlag === true) {
          multipleSelectionFlag = false;
          charCountStart = charCountEnd = charCountStart + this.selectionLength;
        }
      }
      this.cursorSelection = { startChar: charCountStart, endChar: charCountEnd };
    }
  }

  /**
   * Restore the saved cursor selection from a field variable.
   * Does so on mainDiv character level instead of span level, as the spans can change.
   * @param inputCursorSelection - optional CursorSelection. If passed, this input is restored.
   * If left undefined the field variable is restored.
   */
  public static restoreCursorSelection(inputCursorSelection?: CursorSelection): void {
    // check if we should restore the field variables or the input
    let startChar;
    let endChar;
    if (inputCursorSelection) {
      startChar = inputCursorSelection.startChar;
      endChar = inputCursorSelection.endChar;
    } else {
      if (!this.cursorSelection) {
        return;
      }
      startChar = this.cursorSelection.startChar;
      endChar = this.cursorSelection.endChar;
    }

    // transform cursorSelection startChar and endChar into (startNode, startOffset), (endNode, endOffset)
    let charCounter = 0;
    const mainDiv = $('#mainDiv')[0];
    let spanEl = mainDiv.firstChild;
    let startNode;
    let endNode;
    let startOffset;
    let endOffset;

    if (spanEl) {
      // there is some text in the mainDiv

      while (charCounter + spanEl.innerText.length < startChar) {
        charCounter += spanEl.innerText.length;
        spanEl = spanEl.nextSibling;
      }
      startNode = spanEl.firstChild;
      startOffset = startChar - charCounter;

      while (charCounter + spanEl.innerText.length < endChar) {
        charCounter += spanEl.innerText.length;
        spanEl = spanEl.nextSibling;
      }
      endNode = spanEl.firstChild;
      endOffset = endChar - charCounter;
    } else {
      // the mainDiv is empty

      // simply set it to the first position
      startNode = mainDiv;
      endNode = mainDiv;
      startOffset = 0;
      endOffset = 0;
    }

    // update selection to (startNode, startOffset), (endNode, endOffset)
    const doc = window.document;
    if (window.getSelection && doc.createRange) {
      const sel = window.getSelection();
      const range = doc.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
  /**
   * Sets the start and end index corresponding to the tag in-order to assign a class for the words embedded in the tag.
   * @param content: The content string to be spanned
   * @param referenceTag: mark for insert and em for delete
   * @param absentTag: If reference tag is mark then absent is em and vice versa
   */

  public static setWordIndices(content: string, referenceTag: string, absentTag: string): string {
    const contentWords = SpanService.tokenizeString(content).filter(
      word => (word !== '<') && (word !== '>') && (word !== '/') && (word !== absentTag));
    if (referenceTag === 'mark') {
      SpanService.startInsertIndex = contentWords.indexOf('mark') + 1;
      SpanService.endInsertIndex = contentWords.lastIndexOf('mark') - 1;
      return content.replace('<mark>', '').replace('</mark>', '');
    } else {
      SpanService.startDeleteIndex = contentWords.indexOf('em') + 1;
      SpanService.endDeleteIndex = contentWords.lastIndexOf('em') - 1;
      return content.replace('<em>', '').replace('</em>', '');
    }
  }

  /**
   * Adds a html <span></span> to each grammatical token of a string and appends these spans into the domElement.
   *
   * @param content - the text spans should be inserted into
   * @param domElement - the dom element the content should be inserted into
   * @param spanOnlyWords - decide if special characters and spaces should be in spans or only as normal parts of domEl
   */
  public static initDomElement(content: string, domElement: HTMLElement, spanOnlyWords: boolean): void {
    let iterator = 0;
    this.clearDomElement(domElement);
    if (content.indexOf('<mark>') !== -1) {
      // returns content without the tag
      content = this.setWordIndices(content, 'mark', 'em');
    }
    if (content.indexOf('<em>') !== -1) {
      // returns content without the tag
      content = this.setWordIndices(content, 'em', 'mark');
    }
    const splitContent: string[] = SpanService.tokenizeString(content);
    for (const str of splitContent) {
      iterator += 1;
      if (!spanOnlyWords || (!SpanService.wordSeparators.includes(str) && str !== ' ' && str.charCodeAt(0) !== 160)) {
        // add a real span
        let el;
        // If the token is a whitespace, add whitespace class.
        if (iterator >= SpanService.startDeleteIndex && iterator <= SpanService.endDeleteIndex) {
          el = $('<span class = ' + 'whitespace' + '>' + str + '</span>');
          $(el).addClass('deleteWord');
        } else if (str === ' ' || str.charCodeAt(0) === 160) {
           el = $('<span class = ' + 'whitespace' + '>' + str + '</span>');
        } else if (iterator >= SpanService.startInsertIndex && iterator <= SpanService.endInsertIndex) {
          el = $('<span class = ' + 'insertWord' + '>' + str + '</span>');

        } else {
          el = $('<span>' + str + '</span>');
        }
        domElement.append(el);
      } else {
        // add only the str
        domElement.append(str);
      }
    }
    SpanService.startInsertIndex = -1;
    SpanService.endInsertIndex = -1;
    SpanService.startDeleteIndex = -1;
    SpanService.endDeleteIndex = -1;
    SpanService.resetSpanIDs(domElement);
  }

  public static getCursorPosDiv(div) {
    // TODO is this function still needed? Can we also just use the cursorSelection field?
    try {
      const input = window.getSelection() || document.getSelection();
      let range;
      // input = document.createRange();

      if (window.getSelection && document.createRange) {
        // console.log('cursorPos: selection available', input);
        // usersel=window.getSelection();
        if (input.rangeCount && input.rangeCount === 0) {
          return { begin: -1, end: -1 };
        }
        range = input.getRangeAt(0);
        // console.log('cursorPos: ', range);

        const content = document.getElementById(div);
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(content);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        const start = preSelectionRange.toString().length;
        // console.log('cursorPos:', start, range);

        // console.log(start)
        return {
          begin: start,
          end: start + range.toString().length
        };
      } else if (document.createRange()) {
        range = document.createRange();

        if (range && range.parentElement === div) {
          console.log('cursorPos: selection not available');
          let len;
          let pos;
          const rng = div.createTextRange();
          rng.moveToBookmark(range.getBookmark());
          for (len = 0; rng.compareEndPoints('EndToStart', rng) > 0; rng.moveEnd('character', -1)) {
            len++;
          }
          rng.setEndPoint('StartToStart', div.createTextRange());
          for (pos = { begin: 0, end: len }; rng.compareEndPoints('EndToStart', rng) > 0; rng.moveEnd('character', -1)) {
            pos.begin++;
            pos.end++;
          }
          return pos;
        }
      }

      return { begin: -1, end: -1 };
    } catch (err) {
      return { begin: -2, end: -2 };
    }
  }
}
