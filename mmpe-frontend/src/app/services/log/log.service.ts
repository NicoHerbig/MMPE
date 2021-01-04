import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {InteractionModality} from '../../model/InteractionModality';
import {SpanService} from '../span/span.service';
import {InteractionSource} from '../../model/InteractionSource';
import {CursorSelection} from '../../model/CursorSelection';

@Injectable({
  providedIn: 'root'
})
export class LogService {
  constructor(private httpClient: HttpClient) {}

  private static initialString = '';
  private static finalString = '';
  private static checkString = '';

  private readonly CURSOR_POSITION = 'cursorPosition';
  private readonly CURSOR_ANCHOR = 'cursorAnchor';
  private readonly CURSOR_FOCUS = 'cursorFocus';

  private readonly TYPE = 'type';
  private readonly INTERACTION_MODALITY = 'interactionModality';
  private readonly INTERACTION_SOURCE = 'interactionSource';
  private readonly TIMESTAMP = 'ts';
  private readonly EYETRACKER_TIMESTAMP = 'tsEyeTracker';
  private readonly TARGET = 'target';
  private readonly BUTTON = 'button';
  private readonly KEY = 'key';
  private readonly COORDINATES = 'coordinates';
  private readonly START = 'start';
  private readonly END = 'end';
  private readonly SPAN_ID = 'spanId';
  private readonly SPAN_TEXT = 'spanText';
  private readonly SPAN_SIDE = 'spanSide';
  private readonly SEGMENT_TEXT = 'segmentText';
  private readonly CLIPBOARD_CONTENT = 'clipboardContent';
  private readonly SEGMENT_TEXT_OLD = 'segmentTextOld';
  private readonly SEGMENT_TEXT_NEW = 'segmentTextNew';
  private readonly RESULT = 'result';
  private readonly SEARCH_TERM = 'searchTerm';
  private readonly SPEECH_COMMAND_RAW = 'speechCommandRaw';
  private readonly SPEECH_COMMAND_CORRECTED = 'speechCommandCorrected';
  private readonly SPEECH_ENTITY = 'speechEntity';
  private readonly SPEECH_OPERATION = 'speechOperation';
  private readonly SPEECH_MM_ENTITY = 'speechMMEntity';
  private readonly POSITION = 'token';
  private readonly POSITION_OLD = 'positionOld';
  private readonly POSITION_NEW = 'positionNew';
  private readonly POSITIONS = 'tokens';
  private readonly WORD = 'word';
  private readonly WORD_OLD = 'wordOld';
  private readonly WORD_NEW = 'wordNew';
  private readonly WORDS = 'words';
  private readonly DURATION = 'duration';
  private readonly DISPERSION = 'dispersion';
  private readonly X_COORD = 'x';
  private readonly Y_COORD = 'y';
  private readonly LEFT = 'left';
  private readonly RIGHT = 'right';
  private readonly KEYLOG = 'keylog';

  private readonly STUDY_MODALITY = 'studyModality';
  private readonly STUDY_OPERATION = 'studyOperation';
  private readonly STUDY_CORRECTION = 'studyCorrection';
  private readonly STUDY_TRIAL = 'studyTrial';
  private spanID;
  private httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' })
  };

  private lowLevelURL = 'http://localhost:3000/log/lowlevel';
  private highLevelURL = 'http://localhost:3000/log/highlevel';
  private generalInfo = {};

  private lastUndoRedo; // needed so that we can ignore high level handwriting and main logs triggered after undo/redo
  private mediumLevelKeyLog = []; // used to temporarily store the recent key events, that are then sent after typing finished
  /**
   * Calculates the difference between the strings a and b. Returns the changed words and their positions.
   * Used to analyze the Pen input
   * Assumes "b" contains a subsequence containing all of the letters in "a" in the same order
   * @param shorterString - words of string a
   * @param longerString - words of string b
   * @return a tuple where pos 0 corresponds to the changed words and pos 1 corresponds to their positions.
   */
  public static getStringDifference(shorterString: string[], longerString: string[]): [string[], string[]] {
    let i = 0;
    let j = 0;
    const resultWords = [];
    const resultPositions = [];
    while (j < longerString.length) {
      if (shorterString[i] !== longerString[j] || i === shorterString.length) {
        resultWords.push(longerString[j]);
        resultPositions.push(j);
      } else {
        i++;
      }
      j++;
    }
    return [resultWords, resultPositions];
  }

  // check word form changes
  /**
   * Analyzes word pairs for differences and returns triples of (wordOld, wordNew, wordPos) for those that are not equal.
   * @param newWords - words of the new text
   * @param oldWords - words of the old text
   * @return triples of (wordOld, wordNew, wordPos) for the word pairs that are not equal.
   */
  private static getWordDifferences(newWords: string[], oldWords: string[]): [string[], string[], number[]] {
    if (newWords.length !== oldWords.length) {
      console.error('This function should only be called on sentences of equal word length');
    }
    let j = 0;
    const resultWordsPrev = [];
    const resultWordsNew = [];
    const resultPositions = [];

    while (j < oldWords.length) {
      if (newWords[j] !== oldWords[j]) {
        resultWordsPrev.push(oldWords[j]);
        resultWordsNew.push(newWords[j]);
        resultPositions.push(j);
      }
      j++;
    }
    return [resultWordsPrev, resultWordsNew, resultPositions];
  }

  // Returns the largest matching string
  private static largestMatch(oldString, newString) {
    if (oldString.length < newString.length) {
      return this.largestMatch(newString, oldString);
    }

    let matchingLength = oldString.length,
      possibleMatch,
      index;

    while (matchingLength) {
      index = 0;
      while (index + matchingLength <= oldString.length) {
        possibleMatch = oldString.substr(index, matchingLength);
        if (~newString.indexOf(possibleMatch)) {
          return oldString.substr(index, matchingLength);
        }
        index++;
      }
      matchingLength--;
    }
    return '';
  }

  // Counts the frequency of a string in an array of strings
  private static countOccurrencesOf(word, search) {
    let countWord = 0;
    for (let i = 0; i < search.length; i++) {
      if (search[i] === word) {
        countWord++;
      }
    }
    return countWord;
  }

  // Finds the difference between strings. Ex: If a <word1> b and a <word2, word3,...> b is given,
  // it helps in setting the value of initial string to <word1> and final string to <word2,word3,...>
  private static differenceStrings(oldValue, newValue) {
    let largestMatch = this.largestMatch(oldValue, newValue);
    let preNew;
    let postNew;
    let preOld;
    let postOld;
    if (largestMatch) {
      preNew = newValue.substr(0, newValue.indexOf(largestMatch));
      preOld = oldValue.substr(0, oldValue.indexOf(largestMatch));
      postNew = newValue.substr(preNew.length + largestMatch.length);
      postOld = oldValue.substr(preOld.length + largestMatch.length);
      largestMatch = largestMatch.replace(/\s/g, '');
      if (largestMatch.trim().length <= 2) {
        this.checkString = '';
        this.initialString = oldValue;
        this.finalString = newValue;
        return;
      } else if (this.checkString.length < largestMatch.length) {
        this.checkString = largestMatch;
        this.initialString = preOld;
        this.finalString = preNew;
      }
      return this.differenceStrings(preOld, preNew) + largestMatch + this.differenceStrings(postOld, postNew);
    }
  }
  /**
   * Function to specify which key value pairs should always be added to a log.
   * @param key - the key
   * @param value - the value
   */
  public addGeneralInformation(key: string, value: any) {
    this.generalInfo[key] = value;
  }

  /**
   * Used to log a mouse click
   *
   * @param interactionSource - the InteractionSource of the click
   * @param interactionModality - the InteractionModality of the click
   * @param button - the button that was clicked (left = 0, wheel = 1, right = 2), in case modality was MOUSE
   * @param target - the target on that was clicked
   * @param coordinates - the page coordinates of the click (range [0, 1] is the initial viewport)
   */
  public logMouseClick(interactionSource: InteractionSource, interactionModality: InteractionModality,
                       button: string, target: string, coordinates?) {
    const payload = {};

    payload[this.TYPE] = 'MOUSE_CLICK_SINGLE';
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.BUTTON] = button;
    payload[this.TARGET] = target;
    this.spanID = target;
    payload[this.COORDINATES] = coordinates;

    this.sendRequest(this.lowLevelURL, payload);
  }

  /**
   * Used to log a mouse double click
   *
   * @param interactionSource - the InteractionSource of the dblClick
   * @param interactionModality - the InteractionModality of the click
   * @param button - the button that was clicked (left = 0, wheel = 1, right = 2)
   * @param target - the target on that was clicked
   * @param coordinates - the page coordinates of the click (range [0, 1] is the initial viewport)
   */
  public logMouseDoubleClick(interactionSource: InteractionSource, interactionModality: InteractionModality, button, target, coordinates) {
    const payload = {};

    payload[this.TYPE] = 'MOUSE_CLICK_DOUBLE';
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.BUTTON] = button;
    payload[this.TARGET] = target;
    payload[this.COORDINATES] = coordinates;

    this.sendRequest(this.lowLevelURL, payload);
  }

  /**
   * Used to log a mouse drag (left button)
   *
   * @param interactionSource - the InteractionSource of the mouse drag
   * @param start - the start position of the drag (initial click)
   * @param end - the end position of the drag (button release)
   * @param target - the target that was dragged
   */
  public logMouseDrag(interactionSource: InteractionSource, start, end, target) {
    const payload = {};

    payload[this.TYPE] = 'MOUSE_DRAG';
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.INTERACTION_MODALITY] = InteractionModality[InteractionModality.MOUSE];
    payload[this.START] = start;
    payload[this.END] = end;
    payload[this.TARGET] = target;

    this.sendRequest(this.lowLevelURL, payload);
  }

  /**
   * Function to intermediately store all keypress relevant data.
   * Call logTypingFinished in the end to send the intermediate version to the server and clear it.
   * @param key - which key was pressed
   * @param segment - the status of the segment before the key was pressed
   * @param cursorSelection - the start and end of the cursor selection
   */
  public storeKeyEventForLogging(key: string, segment: string, cursorSelection: CursorSelection) {
    this.mediumLevelKeyLog.push([key, segment, cursorSelection, Date.now()]);
    // console.log(this.mediumLevelKeyLog);
  }
  public editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else {
          if (j > 0) {
            let newValue = costs[j - 1];
            if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            }
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0) {
        costs[s2.length] = lastValue;
      }
    }
    return costs[s2.length];
  }

  public similarity(s1, s2) {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) {
      longer = s2;
      shorter = s1;
    }
    const longerLength = longer.length;
    if (longerLength === 0) {
      return 1.0;
    }
    return (longerLength - this.editDistance(longer, shorter)) / parseFloat(longerLength);
  }

  public generateHighLevelTextLog(
    segmentTextOld: string,
    segmentTextNew: string,
    interactionModality: InteractionModality,
    interactionSource: InteractionSource,
  ) {
    segmentTextOld = segmentTextOld.replace(new RegExp(String.fromCharCode(160), 'g'), ' ');
    segmentTextNew = segmentTextNew.replace(new RegExp(String.fromCharCode(160), 'g'), ' ');
    LogService.differenceStrings(segmentTextOld, segmentTextNew);
    const initialWords = SpanService.tokenizeString(LogService.initialString).filter((word) => word !== ' ');
    const finalWords = SpanService.tokenizeString(LogService.finalString).filter((word) => word !== ' ');
    const [newWords, newPositions] = LogService.getStringDifference(initialWords, finalWords);
    const [previousWords, positionReplaced] = LogService.getStringDifference(finalWords, initialWords);
    LogService.checkString = '';
    const wordsOldText = SpanService.tokenizeString(segmentTextOld);
    const wordsNewText = SpanService.tokenizeString(segmentTextNew);
    const wordsTextOld = SpanService.tokenizeString(segmentTextOld).filter((word) => word !== ' ');
    const wordsTextNew = SpanService.tokenizeString(segmentTextNew).filter((word) => word !== ' ');
    const spacesOldText = SpanService.tokenizeString(segmentTextOld).filter((word) => word === ' ').length;
    const spacesNewText = SpanService.tokenizeString(segmentTextNew).filter((word) => word === ' ').length;
    const newlinesOldText = segmentTextOld.split('\n').length;
    const newlinesNewText = segmentTextNew.split('\n').length;
    if (spacesOldText > spacesNewText && wordsTextNew.length === wordsTextOld.length) {
      const [delWords, delPos] = LogService.getStringDifference(segmentTextNew.split(''), segmentTextOld.split(''));
      const count = this.returnWordPos(delPos[0], segmentTextOld);
      if (delPos.length === 1 && delWords.length  === 1) {
        console.log('a space was removed');
        this.logDeleteSingle(interactionModality, interactionSource, segmentTextOld, segmentTextNew, (count - 1).toString(), ' ');
    } else {
      const deletePosition = [];
      const deleteSpace = [];
      console.log('multiple spaces were removed');
      for (var i = 0; i < (spacesOldText - spacesNewText); i++) {
        deletePosition.push(count + i);
        deleteSpace.push(' ');
      }
      this.logDeleteGroup(interactionModality, interactionSource, segmentTextOld, segmentTextNew, deletePosition, deleteSpace);
    }
  }
    for (let i = 0; i < previousWords.length; i++) {
      if (LogService.countOccurrencesOf(previousWords[i], wordsOldText) === 1) {
        let baseIndex = wordsOldText.indexOf(previousWords[i]) + 1;
        let temp = baseIndex;
        positionReplaced[i] = baseIndex.toString();
        for (let j = i + 1; j < previousWords.length; j++) {
          positionReplaced[j] = (temp + 1).toString();
          temp = temp + 1;
        }
        for (let k = i - 1; k >= 0; k--) {
          positionReplaced[k] = (baseIndex - 1).toString();
          baseIndex = baseIndex - 1;
        }
        break;
      }
    }
    if (wordsOldText.length === wordsNewText.length) {
      // WORD FORM CHANGE
      const [resultWordsPrev, resultWordsNew, resultPositions] = LogService.getWordDifferences(wordsNewText, wordsOldText);
      for (let i = 0; i < resultWordsPrev.length; i++) {
        if (
          this.similarity(resultWordsPrev[i], resultWordsNew[i]) > 0.5 ||
          resultWordsPrev[i].includes(resultWordsNew[i]) ||
          resultWordsNew[i].includes(resultWordsPrev[i])
        ) {
          this.logReplacePartial(
            interactionModality,
            interactionSource,
            segmentTextOld,
            segmentTextNew,
            resultPositions[i] + '',
            resultWordsPrev[i],
            resultWordsNew[i],
          );
        } else {
          this.logReplaceSingle(
            interactionModality,
            interactionSource,
            segmentTextOld,
            segmentTextNew,
            resultPositions[i] + '',
            resultWordsPrev[i],
            resultWordsNew[i],
          );
        }
      }
      // tslint:disable-next-line:max-line-length
    } else if (newWords.length > 0 && previousWords.length > 0 && wordsOldText.length !== wordsNewText.length + 1) {
      // SELECT TEXT AND REPLACE
      this.logReplaceSingle(
        interactionModality,
        interactionSource,
        segmentTextOld,
        segmentTextNew,
        'words: ' + '[' + positionReplaced.toString() + ']',
        '[' + previousWords.toString() + ']',
        '[' + newWords.toString() + ']',
      );
    } else if (wordsTextOld.length === wordsTextNew.length + 1) {
      // DELETE SINGLE
      console.log('Delete single');
      let [delWords, delPos] = LogService.getStringDifference(wordsNewText, wordsOldText);
      if (delWords.length !== 1 || delPos.length !== 1) {
        // it's more than one when a space was added, so check for this
        if (spacesOldText === spacesNewText + 1) {
          // Check if space was removed
          [delWords, delPos] = LogService.getStringDifference(segmentTextNew.split(''), segmentTextOld.split(''));
          if (delWords.length !== 1 || delPos.length !== 1) {
            const deletedWords = [];
            let deletedWord = '';
            const countDeleted = [];
            // tslint:disable-next-line:prefer-for-of
            for (let j = 0; j < delWords.length; j++) {
              if (delWords[j] !== ' ') {
                deletedWord += delWords[j];
              } else {
                deletedWords.push(deletedWord);
                deletedWords.push(' ');
              }
            }

            const count = this.returnWordPos(delPos[0], segmentTextOld);
            for (let j = 0; j < deletedWords.length; j++) {
              countDeleted.push(count - 1 + j);
            }
            this.logDeleteGroup(interactionModality, interactionSource, segmentTextOld, segmentTextNew, deletedWords, countDeleted);
          } else {
            console.log('a space was removed');
            const count = this.returnWordPos(delPos[0], segmentTextOld);
            this.logDeleteSingle(interactionModality, interactionSource, segmentTextOld, segmentTextNew, (count - 1).toString(), ' ');
          }
        } else {
          console.log('Spaces not just one bigger: ', spacesOldText, spacesNewText, delPos);
          const difference = spacesOldText - spacesNewText;
          const deletePosition = [];
          const deleteSpace = [];
          for (let ele = 0; ele < difference; ele++) {
            deletePosition.push(delPos[ele]);
            deleteSpace.push(' ');
          }
          this.logDeleteGroup(interactionModality, interactionSource, segmentTextOld, segmentTextNew, deletePosition, deleteSpace);
        }
      } else {
        console.log('a word was removed');
        // tslint:disable-next-line:max-line-length
        this.logDeleteSingle(interactionModality, interactionSource, segmentTextOld, segmentTextNew, delPos[0], delWords[0]);
      }
    } else if (wordsTextOld.length > wordsTextNew.length + 1) {
      // DELETE MULTIPLE
      console.log('Delete multiple');
      const [delWords, delPos] = LogService.getStringDifference(wordsNewText, wordsOldText);
      this.logDeleteGroup(interactionModality, interactionSource, segmentTextOld, segmentTextNew, delPos, delWords);
    } else if (wordsOldText.length + 1 === wordsNewText.length) {
      // INSERT SINGLE
      console.log('Insert single');
      let [addWords, addPos] = LogService.getStringDifference(wordsOldText, wordsNewText);
      if (addWords.length !== 1 || addPos.length !== 1) {
        // it's more than one when a space was added, so check for this
        if (spacesOldText === spacesNewText - 1) {
          // Check if space was added
          [addWords, addPos] = LogService.getStringDifference(segmentTextOld.split(''), segmentTextNew.split(''));
          if (addWords.length !== 1 || addPos.length !== 1) {
            console.log(
              'ERROR: was in case insert single but encountered something else. Logging an unresolved Input ' + 'case which can be manually analyzed',
              segmentTextOld,
              segmentTextNew,
              addWords,
              addPos,
            );
            this.logUnresolvedHandwritingInput(interactionModality, interactionSource, segmentTextOld, segmentTextNew);
          } else {
            console.log('a space was added');
            this.logInsertSingle(interactionModality, interactionSource, segmentTextOld, segmentTextNew, addPos[0], ' ');
          }
        }
      } else {
        // tslint:disable-next-line:max-line-length
        this.logInsertSingle(interactionModality, interactionSource, segmentTextOld, segmentTextNew, addPos[0], addWords[0]);
      }
    } else if (wordsOldText.length + 1 < wordsNewText.length) {
      // INSERT MULTIPLE
      if (segmentTextOld.length + 1 === segmentTextNew.length) {
        console.log('inserted character which increased word amount by 2');
        let char = '';
        let i = 0;
        for (; i < segmentTextNew.length; i++) {
          if (segmentTextNew[i] !== segmentTextOld[i]) {
            char = segmentTextNew[i];
            break;
          }
        }
        this.logInsertSingle(interactionModality, interactionSource, segmentTextOld, segmentTextNew, 'char' + i, char);
      } else {
        console.log('Insert multiple', wordsOldText.length, wordsNewText.length, spacesNewText, spacesOldText);
        let [addWords, addPos] = LogService.getStringDifference(wordsOldText, wordsNewText);
        const spaceDifference = spacesNewText - spacesOldText;
        const wordDifference = wordsNewText.length - wordsOldText.length;
        const addedWords = [];
        const addedPos = [];
        if (wordDifference === spaceDifference + 1) {
          for (let i = 0; i < spaceDifference; i++) {
            addedPos.push(addPos[i]);
            addedWords.push(addWords[i]);
          }
          addWords = addedWords;
          addPos = addedPos;
        }
        if (addWords.length === 1) {
        this.logInsertSingle(interactionModality, interactionSource, segmentTextOld, segmentTextNew, addPos[0], addWords[0]);
        } else {
        this.logInsertGroup(interactionModality, interactionSource, segmentTextOld, segmentTextNew, addPos, addWords);
        }
      }
    } /*else { // DEFAULT SHOULD NOT HAPPEN
      console.error('This case should not exist');
    }*/
    // Check for editing gestures
    if (newlinesOldText === newlinesNewText - 1) {
      // Check if a newline was added --> space was made to write
      console.log('a newline was added');
      // should we log this?
    } else if (newlinesOldText === newlinesNewText + 1) {
      // Check if a newline was removed --> text was combined again after inserting something
      console.log('a newline was removed');
      // should we log this?
    }
  }
/**
 * Returns word position given the character position and segment
 * charPos : Character position
 * segment : Block of text
 *
 */
  public returnWordPos(charPos, segment) {
    const charArray = SpanService.tokenizeString(segment);
    let count = 0;
    for (let z = 0; z < charArray.length ; z++) {
    // tslint:disable-next-line:radix
          if (parseInt (charPos) < count) {
            count = z;
            return count;
          } else {
            count += charArray[z].length;
          }
        }
  }
  /**
   * Logs the mediumLevelKeyLog alongside the current segment text on the server, and resets the mediumLevelKeyLog
   * @param segment - the segment text at the end of typing
   */
  public logTypingFinished(segment) {
    const payload = {};

    payload[this.TYPE] = 'TYPING_FINISHED';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.MAIN];
    payload[this.INTERACTION_MODALITY] = InteractionModality[InteractionModality.KEYBOARD];
    payload[this.SEGMENT_TEXT] = segment;
    payload[this.KEYLOG] = this.mediumLevelKeyLog;

    this.sendRequest(this.lowLevelURL, payload);

    this.mediumLevelKeyLog = []; // reset
  }

  /**
   * Used to log a touch cursor placement
   *
   * @param interactionModality - the modality that was used for the interaction (i.e. FINGER or PEN)
   * @param segmentText - the currently selected segment
   * @param spanId - the position of the tapped span within the segment
   * @param spanSide - the side of the span that was tapped on
   */
  public logTouchCursor(interactionModality: InteractionModality, segmentText: string, spanId: string, spanSide: string) {
    const payload = {};
    payload[this.TYPE] = 'TOUCH_CURSOR';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.MAIN];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.SEGMENT_TEXT] = segmentText;
    payload[this.SPAN_ID] = spanId;
    payload[this.SPAN_SIDE] = spanSide;

    this.sendRequest(this.lowLevelURL, payload);
  }

  /**
   * Used to log a touch cursor placement
   *
   * @param interactionModality - the modality that was used for the interaction (i.e. FINGER or PEN)
   * @param segmentText - the currently selected segment
   * @param spanId1 - the position of the span within the segment which was first tapped
   * @param spanId2 - the position of the span within the segment which was tapped second
   */
  public logTouchDoubleTap(interactionModality: InteractionModality, segmentText: string, spanId1: string, spanId2: string) {
    const payload = {};
    payload[this.TYPE] = 'TOUCH_DOUBLE_TAP';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.MAIN];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.SEGMENT_TEXT] = segmentText;
    payload[this.SPAN_ID + '1'] = spanId1;
    payload[this.SPAN_ID + '2'] = spanId2;

    this.sendRequest(this.lowLevelURL, payload);
  }

  /**
   * Used to log a drag start
   *
   * @param interactionModality - the modality that was used for the interaction (i.e. FINGER or PEN)
   * @param spanText - the dragged word
   * @param spanId - the position of the picked up word
   * @param segmentText - the text of selected segment
   */
  public logDragStart(interactionModality: InteractionModality, spanText: string, spanId: string, segmentText: string) {
    const payload = {};
    payload[this.TYPE] = 'TEXT_DRAGSTART';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.MAIN];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.SPAN_TEXT] = spanText;
    payload[this.SPAN_ID] = spanId;
    payload[this.SEGMENT_TEXT] = segmentText;

    this.sendRequest(this.lowLevelURL, payload);
  }

  /**
   * Used to log a drag move
   *
   * @param interactionModality - the modality that was used for the interaction (i.e. FINGER or PEN)
   * @param spanText - the dragged word
   * @param spanId - the position of the picked up word
   * @param segmentText - the text of selected segment
   * @param spanSide - the side to which the move indicator is positioned, relative to the element underneath
   */
  public logDragMove(interactionModality: InteractionModality, spanText: string, spanId: string, segmentText: string, spanSide: string) {
    const payload = {};
    payload[this.TYPE] = 'TEXT_DRAGMOVE';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.MAIN];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.SPAN_TEXT] = spanText;
    payload[this.SPAN_ID] = spanId;
    payload[this.SEGMENT_TEXT] = segmentText;
    payload[this.SPAN_SIDE] = spanSide;

    this.sendRequest(this.lowLevelURL, payload);
  }

  /**
   * Used to log a drag end
   *
   * @param interactionModality - the modality that was used for the interaction (i.e. FINGER or PEN)
   * @param spanText - the dragged word
   * @param spanId - the position of the picked up word
   * @param segmentText - the text of selected segment
   */
  public logDragStop(interactionModality: InteractionModality, spanText: string, spanId: string, segmentText: string) {
    const payload = {};
    payload[this.TYPE] = 'TEXT_DRAGEND';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.MAIN];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.SPAN_TEXT] = spanText;
    payload[this.SPAN_ID] = spanId;
    payload[this.SEGMENT_TEXT] = segmentText;

    this.sendRequest(this.lowLevelURL, payload);
  }

  /**
   * Used to log speech input
   *
   * @param speechCommandRaw - the detected input without post-processing
   * @param speechCommandCorrected - the corrected speech with capitalization
   * @param operationType - the operation that was triggered based on input
   * @param entity - the word(s) to be manipulated
   * @param segmentText - the currently selected segment
   */
  public logSpeechInput(speechCommandRaw: string, speechCommandCorrected: string, operationType: string, entity: string, segmentText: string) {
    const payload = {};
    payload[this.TYPE] = 'SPEECH_INPUT';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.MICROPHONE];
    payload[this.INTERACTION_MODALITY] = InteractionModality[InteractionModality.SPEECH];
    payload[this.SPEECH_COMMAND_RAW] = speechCommandRaw;
    payload[this.SPEECH_COMMAND_CORRECTED] = speechCommandCorrected;
    payload[this.SPEECH_ENTITY] = entity;
    payload[this.SPEECH_OPERATION] = operationType;
    payload[this.SEGMENT_TEXT] = segmentText;

    this.sendRequest(this.lowLevelURL, payload);
  }

  /**
   * Logs when Speech Service determined that some PEN/FINGER/MOUSE input occurred that can be combined with speech.
   * @param interactionModality - the modality that was used, i.e. PEN/FINGER/MOUSE
   * @param entity - the entity that was selected using this modality
   * @param segmentText - the current text of the segment
   */
  public logSpeechMultiModalEntity(interactionModality: InteractionModality, entity: string, segmentText: string) {
    const payload = {};
    payload[this.TYPE] = 'SPEECH_MM_ENTITY';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.MAIN];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.SPEECH_MM_ENTITY] = entity;
    payload[this.SEGMENT_TEXT] = segmentText;

    this.sendRequest(this.lowLevelURL, payload);
  }

  /**
   * Used to log pen input
   *
   * @param segmentTextOld - the text of selected segment before change
   * @param segmentTextNew - the text of selected segment after change
   * @param interactionModality - with which interaction type the change happened
   */
  public logHandwritingInput(segmentTextOld: string, segmentTextNew: string, interactionModality: InteractionModality) {
    if (this.lastUndoRedo && Date.now() - this.lastUndoRedo < 800) {
      return;
    }

    const payload = {};
    payload[this.TYPE] = 'HANDWRITING_INPUT';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.HANDWRITING];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;

    this.sendRequest(this.lowLevelURL, payload);

    // So far, this is more low level, meaning before & after but not INSERT/DELETE/MOVE, so we need to check this
    // if newText shorter oldText --> delete (single or multiple) or word form change
    // while newText gets longer or equal oldText (equal because L first creates I then L) --> insert
    this.generateHighLevelTextLog(segmentTextOld, segmentTextNew, interactionModality, InteractionSource.HANDWRITING);
  }

  /**
   * Log that something happened which my pen parsing could not understand.
   * @param interactionType - the interaction type used to perform the insertion
   * @param interactionSource - the interaction source used to perform the insertion
   * @param segmentTextOld - the text of selected segment before change
   * @param segmentTextNew - the text of selected segment after change
   */
  public logUnresolvedHandwritingInput(
    interactionType: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
  ) {
    const payload = {};
    payload[this.TYPE] = 'UNRESOLVED_INPUT';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionType];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the insertion of a single word
   *
   * @param interactionType - the interaction type used to perform the insertion
   * @param interactionSource - the interaction source used to perform the insertion
   * @param segmentTextOld - the text of selected segment before change
   * @param segmentTextNew - the text of selected segment after change
   * @param position - the position where the deletion happened - is a string description
   * @param word - the inserted word
   */
  public logInsertSingle(
    interactionType: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    position: string,
    word: string,
  ) {
    const payload = {};
    payload[this.TYPE] = 'INSERT_SINGLE';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionType];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.POSITION] = position;
    payload[this.WORD] = word;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the insertion of a word sequence
   *
   * @param interactionType - the interaction type used to perform the insertion
   * @param interactionSource - the interaction source used to perform the insertion
   * @param segmentTextOld - the text of selected segment before change
   * @param segmentTextNew - the text of selected segment after change
   * @param positions - the positions of the inserted words
   * @param words - the inserted words
   */
  public logInsertGroup(
    interactionType: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    positions: string[],
    words: string[],
  ) {
    const payload = {};
    payload[this.TYPE] = 'INSERT_GROUP';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionType];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.POSITIONS] = positions;
    payload[this.WORDS] = words;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the deletion of a single word
   *
   * @param interactionModality - the interaction type used to perform the deletion
   * @param interactionSource - the interaction source used to perform the deletion
   * @param segmentTextOld - the text of selected segment before change
   * @param segmentTextNew - the text of selected segment after change
   * @param position - the position where the deletion happened
   * @param word - the deleted word
   */
  public logDeleteSingle(
    interactionModality: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    position: string,
    word: string,
  ) {
    const payload = {};
    payload[this.TYPE] = 'DELETE_SINGLE';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.POSITION] = position;
    payload[this.WORD] = word;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the deletion of a word sequence
   *
   * @param interactionType - the interaction type used to perform the deletion
   * @param interactionSource - the interaction source used to perform the deletion
   * @param segmentTextOld - the text of selected segment before change
   * @param segmentTextNew - the text of selected segment after change
   * @param positions - the positions of the deleted words
   * @param words - the deleted words
   */
  public logDeleteGroup(
    interactionType: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    positions: string[],
    words: string[],
  ) {
    const payload = {};
    payload[this.TYPE] = 'DELETE_GROUP';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionType];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.POSITIONS] = positions;
    payload[this.WORDS] = words;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the repositioning of a single word
   *
   * @param interactionType - the interaction type used to perform the reordering
   * @param interactionSource - the interaction source used to perform the reordering
   * @param segmentTextOld - the text of selected segment before change
   * @param segmentTextNew - the text of selected segment after change
   * @param word - the word that was moved
   * @param oldPos - the position of the moved word before the reordering
   * @param newPos - the position of the moved word after the reordering
   */
  public logReorderSingle(
    interactionType: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    word: string,
    oldPos: string,
    newPos: string,
  ) {
    const payload = {};
    payload[this.TYPE] = 'REORDER_SINGLE';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionType];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.WORD] = word;
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.POSITION_OLD] = oldPos;
    payload[this.POSITION_NEW] = newPos;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the repositioning of a single word
   *
   * @param interactionType - the interaction type used to perform the reordering
   * @param interactionSource - the interaction source used to perform the reordering
   * @param segmentTextOld - the text of selected segment before change
   * @param segmentTextNew - the text of selected segment after change
   * @param word - the word that was moved
   * @param oldPos - the position of the moved word before the reordering
   * @param newPos - the position of the moved word after the reordering
   */
  public logReorderPartial(
    interactionType: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    word: string,
    oldPos: string,
    newPos: string,
  ) {
    const payload = {};
    payload[this.TYPE] = 'REORDER_PARTIAL';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionType];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.WORD] = word;
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.POSITION_OLD] = oldPos;
    payload[this.POSITION_NEW] = newPos;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the repositioning of a word sequence
   *
   * @param interactionType - the interaction type used to perform the reordering
   * @param interactionSource - the interaction source used to perform the reordering
   * @param segmentTextOld - the text of selected segment before change
   * @param segmentTextNew - the text of selected segment after change
   * @param words - the sequence that was moved
   * @param positionOld - the start position of the moved sequence before the repositioning
   * @param positionNew - the start position of the moved sequence after the repositioning
   */
  public logReorderGroup(
    interactionType: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    words: string[],
    positionOld,
    positionNew,
  ) {
    const payload = {};
    payload[this.TYPE] = 'REORDER_GROUP';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionType];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.WORDS] = words;
    payload[this.POSITION_OLD] = positionOld;
    payload[this.POSITION_NEW] = positionNew;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the partial replacement of a word
   *
   * @param interactionType - the interaction type used to perform the partial replacement
   * @param interactionSource - the interaction source used to perform the reordering
   * @param segmentTextOld - the text of selected segment before change
   * @param segmentTextNew - the text of selected segment after change
   * @param position - the position of the changed word
   * @param wordOld - the word before it was partially changed
   * @param wordNew - the word after it was partially changed
   */
  public logReplacePartial(
    interactionType: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    position: string,
    wordOld: string,
    wordNew: string,
  ) {
    const payload = {};
    payload[this.TYPE] = 'REPLACE_PARTIAL';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionType];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.POSITION] = position;
    payload[this.WORD_OLD] = wordOld;
    payload[this.WORD_NEW] = wordNew;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the replacement of a word (sequence)
   *
   * @param interactionType - the interaction type used to perform the partial replacement
   * @param interactionSource - the interaction source used to perform the reordering
   * @param segmentTextOld - the text of selected segment before change
   * @param segmentTextNew - the text of selected segment after change
   * @param position - the position of the changed word
   * @param wordOld - the word before it was replaced
   * @param wordNew - the word after it was replaced
   */
  public logReplaceSingle(
    interactionType: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    position: string,
    wordOld: string,
    wordNew: string,
  ) {
    const payload = {};
    payload[this.TYPE] = 'REPLACE';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionType];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.POSITION] = position;
    payload[this.WORD_OLD] = wordOld;
    payload[this.WORD_NEW] = wordNew;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the REPLACE of a word sequence
   *
   * @param interactionType - the interaction type used to perform the replacement
   * @param interactionSource - the interaction source used to perform the replacement
   * @param segmentTextOld - the text of selected segment before change
   * @param segmentTextNew - the text of selected segment after change
   * @param positions - the positions of the inserted words
   * @param words - the inserted words
   */
  public logReplaceGroup(
    interactionType: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    positions: string[],
    words: string[],
    wordsNew: string,
  ) {
    const payload = {};
    payload[this.TYPE] = 'REPLACE_GROUP';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionType];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.POSITIONS] = positions;
    payload[this.WORDS] = words;
    payload[this.WORD_NEW] = wordsNew;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the restatement of a segment
   *
   * @param interactionType - the interaction type used to perform the partial replacement
   * @param interactionSource - the interaction source used to perform the reordering
   * @param segmentTextOld - the text of selected segment before change
   * @param segmentTextNew - the text of selected segment after change
   * @param position - the position of the changed word
   * @param wordOld - the word before it was replaced
   * @param wordNew - the word after it was replaced
   */
  public logRestateSingle(
    interactionType: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    position: string,
    wordOld: string,
    wordNew: string,
  ) {
    const payload = {};
    payload[this.TYPE] = 'RESTATE';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionType];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.POSITION] = position;
    payload[this.WORD_OLD] = wordOld;
    payload[this.WORD_NEW] = wordNew;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the restatement of a segment
   *
   * @param interactionType - the interaction type used to perform the partial replacement
   * @param interactionSource - the interaction source used to perform the reordering
   * @param segmentTextOld - the text of selected segment before change
   * @param segmentTextNew - the text of selected segment after change
   * @param positions - array of position of the changed words
   * @param words - array of words before they were replaced
   * @param wordsNew - array of words after they were replaced
   */
  public logRestateGroup(
    interactionType: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    positions: string[],
    words: string[],
    wordsNew: string,
  ) {
    const payload = {};
    payload[this.TYPE] = 'RESTATE_GROUP';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionType];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.POSITIONS] = positions;
    payload[this.WORDS] = words;
    payload[this.WORD_NEW] = wordsNew;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the rest of the translation (mainDiv)
   *
   * @param interactionModality - indicates whether it was performed with the mouse, finger, or pen
   */
  public logTranslationReset(interactionModality: InteractionModality) {
    const payload = {};
    payload[this.TYPE] = 'RESET';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log a call to the dictionary
   *
   * @param interactionModality - indicates whether it was performed with the keyboard or the mouse
   * @param word - the queried word
   * @param result - the displayed result
   */
  public logDictionaryCall(interactionModality: InteractionModality, word, result) {
    const payload = {};
    payload[this.TYPE] = 'DICTIONARY';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.SEARCH_TERM] = word;
    payload[this.RESULT] = result;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the activation of visualizing whitespaces
   * @param interactionModality - indicates whether it was performed with the mouse, finger, or pen
   */
  public logWhitespacecheckActivation(interactionModality: InteractionModality) {
    const payload = {};
    payload[this.TYPE] = 'WHITESPACE_ACTIVATION';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the activation of editor view
   * @param interactionModality - indicates whether it was performed with the mouse, finger, or pen
   */
  public logHandwritingViewActivation(interactionModality: InteractionModality) {
    const payload = {};
    payload[this.TYPE] = 'HANDWRITING_VIEW_ACTIVATION';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the activation of main view
   * @param interactionModality - indicates whether it was performed with the mouse, finger, or pen
   */
  public logMainViewActivation(interactionModality: InteractionModality) {
    const payload = {};
    payload[this.TYPE] = 'MAIN_VIEW_ACTIVATION';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the activation of visualizing whitespaces
   * @param interactionModality - indicates whether it was performed with the mouse, finger, or pen
   */
  public logWhitespacecheckDeactivation(interactionModality: InteractionModality) {
    const payload = {};
    payload[this.TYPE] = 'WHITESPACE_DEACTIVATION';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the activation of eye tracking
   * @param interactionModality - indicates whether it was performed with the mouse, finger, or pen
   */
  public logEyeTrackingActivation(interactionModality: InteractionModality) {
    const payload = {};
    payload[this.TYPE] = 'EYETRACKING_ACTIVATION';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the activation of eye tracking
   * @param interactionModality - indicates whether it was performed with the mouse, finger, or pen
   */
  public logEyeTrackingDeactivation(interactionModality: InteractionModality) {
    const payload = {};
    payload[this.TYPE] = 'EYETRACKING_DEACTIVATION';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the activation of Leap Motion Controller
   * @param interactionModality - indicates whether it was performed with the mouse, finger, or pen
   */
  public logMidairGesturesActivation(interactionModality: InteractionModality) {
    const payload = {};
    payload[this.TYPE] = 'MIDAIRGESTURES_ACTIVATION';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the activation of eye tracking
   * @param interactionModality - indicates whether it was performed with the mouse, finger, or pen
   */
  public logMidairGesturesDeactivation(interactionModality: InteractionModality) {
    const payload = {};
    payload[this.TYPE] = 'MIDAIRGESTURES_DEACTIVATION';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];

    this.sendRequest(this.highLevelURL, payload);
  }

  public logMidairGesturesCaretMovement(segmentText: string, cursorPos: number) {
    const payload = {};
    payload[this.TYPE] = 'MIDAIRGESTURE_MOVECARET';
    payload[this.INTERACTION_MODALITY] = InteractionModality[InteractionModality.MIDAIRGESTURES];
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.MAIN];
    payload[this.SEGMENT_TEXT] = segmentText;
    payload[this.CURSOR_POSITION] = cursorPos;

    this.sendRequest(this.lowLevelURL, payload);
  }

  public logMidairGesturesSelection(segmentText: string, leftPos: number, rightPos: number, selectedText: string) {
    const payload = {};
    payload[this.TYPE] = 'MIDAIRGESTURE_SELECTION';
    payload[this.INTERACTION_MODALITY] = InteractionModality[InteractionModality.MIDAIRGESTURES];
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.MAIN];
    payload[this.SEGMENT_TEXT] = segmentText;
    payload[this.WORDS] = selectedText;
    payload[this.CURSOR_ANCHOR] = leftPos;
    payload[this.CURSOR_FOCUS] = rightPos;

    this.sendRequest(this.lowLevelURL, payload);
  }

  public logMidairGestureDeleteSingle(
    interactionModality: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    position: string,
    word: string,
  ) {
    const payload = {};
    payload[this.TYPE] = 'MIDAIRGESTURE_DELETE_SINGLE';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.POSITION] = position;
    payload[this.WORD] = word;

    this.sendRequest(this.highLevelURL, payload);
  }

  public logMidairGestureDeleteGroup(
    interactionType: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    positions: string[],
    words: string[],
  ) {
    const payload = {};
    payload[this.TYPE] = 'MIDAIRGESTURE_DELETE_GROUP';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionType];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.POSITIONS] = positions;
    payload[this.WORDS] = words;

    this.sendRequest(this.highLevelURL, payload);
  }

  public logFixation(timestamp: number, duration: number, dispersion: number, x: number, y: number, wordPos: string, word: string, segmentText: string) {
    const payload = {};
    payload[this.TYPE] = 'EYETRACKING_FIXATION';
    payload[this.EYETRACKER_TIMESTAMP] = timestamp;
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.INTERACTION_MODALITY] = InteractionModality.EYETRACKING;
    payload[this.POSITION] = wordPos;
    payload[this.WORD] = word;
    payload[this.SEGMENT_TEXT] = segmentText;
    payload[this.DURATION] = duration;
    payload[this.DISPERSION] = dispersion;
    payload[this.X_COORD] = x;
    payload[this.Y_COORD] = y;

    this.sendRequest(this.highLevelURL, payload);
  }

  public logPupilDiameter(timestamp: number, left: number, right: number) {
    const payload = {};
    payload[this.TYPE] = 'EYETRACKING_PUPIL_DIAMETER';
    payload[this.EYETRACKER_TIMESTAMP] = timestamp;
    payload[this.INTERACTION_MODALITY] = InteractionModality.EYETRACKING;
    payload[this.LEFT] = left;
    payload[this.RIGHT] = right;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the activation of the integrated spellchecking
   * @param interactionModality - indicates whether it was performed with the mouse, finger, or pen
   */
  public logSpellcheckActivation(interactionModality: InteractionModality) {
    const payload = {};
    payload[this.TYPE] = 'SPELLCHECK_ACTIVATION';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the deactivation of the integrated spellchecking
   * @param interactionModality - indicates whether it was performed with the mouse, finger, or pen
   */
  public logSpellcheckDeactivation(interactionModality: InteractionModality) {
    const payload = {};
    payload[this.TYPE] = 'SPELLCHECK_DEACTIVATION';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the activation of the speech input
   * @param interactionModality - indicates whether it was performed with the mouse, finger, or pen
   */
  public logSpeechActivation(interactionModality: InteractionModality) {
    const payload = {};
    payload[this.TYPE] = 'SPEECH_INPUT_ACTIVATION';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the deactivation of the speech input
   * @param interactionModality - indicates whether it was performed with the mouse, finger, or pen
   */
  public logSpeechDeactivation(interactionModality: InteractionModality) {
    const payload = {};
    payload[this.TYPE] = 'SPEECH_INPUT_DEACTIVATION';
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the selection of a segment
   *
   * @param interactionModality - indicates whether it was performed with the keyboard or the mouse
   * @param interactionSource - indicates whether it was performed with a hotkey or the UI button
   */
  public logSegmentSelection(interactionModality: InteractionModality, interactionSource: InteractionSource) {
    const payload = {};
    payload[this.TYPE] = 'SEGMENT_SELECT';
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log the confirmation of a segment
   *
   * @param interactionModality - indicates whether it was performed with the keyboard or the mouse
   * @param interactionSource - indicates whether it was performed with a hotkey or the UI button
   * @param confirmedSegmentText - the confirmed translation
   * @param duration - the time that the user worked on this segment (since last opening until confirm)
   * @param studyOperation - in case we are in study mode, is it a DELETE/REPLACE/REORDER/INSERT
   * @param studyModality - in case we are in study mode, which modality did we ask the participant to use
   * @param studyTrial - in case we are in study mode, was it a trial run or a real run
   * @param studyCorrection - in case we are in study mode, what change did they have to apply
   */
  public logSegmentConfirmation(
    interactionModality: InteractionModality,
    interactionSource: InteractionSource,
    confirmedSegmentText,
    duration: number,
    studyOperation?: string,
    studyModality?: string,
    studyTrial?: boolean,
    studyCorrection?: string,
  ) {
    const payload = {};
    payload[this.TYPE] = 'SEGMENT_CONFIRM';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT] = confirmedSegmentText;
    payload[this.DURATION] = duration;
    if (studyOperation) {
      payload[this.STUDY_OPERATION] = studyOperation;
    }
    if (studyModality) {
      payload[this.STUDY_MODALITY] = studyModality;
    }
    if (studyTrial) {
      payload[this.STUDY_TRIAL] = studyTrial;
    }
    if (studyCorrection) {
      payload[this.STUDY_CORRECTION] = studyCorrection;
    }

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log an undo
   *
   * @param interactionModality - indicates whether it was performed with the keyboard or the mouse
   * @param interactionSource - indicates whether it was performed with a hotkey or the UI button
   * @param segmentTextOld - the segment before the undo operation
   * @param segmentTextNew - the segment after the undo operation
   */
  public logUndo(interactionModality: InteractionModality, interactionSource: InteractionSource, segmentTextOld: string, segmentTextNew: string) {
    this.lastUndoRedo = Date.now();

    const payload = {};
    payload[this.TYPE] = 'UNDO';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;

    this.sendRequest(this.highLevelURL, payload);

    // also store in medium level log that undo was performed
    this.storeKeyEventForLogging('undo', segmentTextNew, { startChar: -1, endChar: -1 });
  }

  /**
   * Used to log a redo
   *
   * @param interactionModality - indicates whether it was performed with the keyboard or the mouse
   * @param interactionSource - indicates whether it was performed with a hotkey or the UI button
   * @param segmentTextOld - the segment before the undo operation
   * @param segmentTextNew - the segment after the undo operation
   */
  public logRedo(interactionModality: InteractionModality, interactionSource: InteractionSource, segmentTextOld: string, segmentTextNew: string) {
    this.lastUndoRedo = Date.now();

    const payload = {};
    payload[this.TYPE] = 'REDO';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;

    this.sendRequest(this.highLevelURL, payload);

    // also store in medium level log that redo was performed
    this.storeKeyEventForLogging('redo', segmentTextNew, { startChar: -1, endChar: -1 });
  }

  /**
   * Used to indicate that a word was copied
   *
   * @param interactionModality - indicates whether it was performed with the keyboard or the mouse
   * @param interactionSource - indicates whether it was performed with the hotkey or the context menu
   * @param mainDivContent - the content of the mainDiv
   */
  public logCopy(interactionModality: InteractionModality, interactionSource: InteractionSource, mainDivContent, clipboardContent) {
    const payload = {};
    payload[this.TYPE] = 'COPY';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT] = mainDivContent;
    payload[this.CLIPBOARD_CONTENT] = clipboardContent;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log if a word is pasted
   *
   * @param interactionModality - indicates whether it was performed with the keyboard or the mouse
   * @param interactionSource - indicates whether it was performed with the hotkey or the context menu
   * @param segmentTextOld - the segment before the undo operation
   * @param segmentTextNew - the segment after the undo operation
   */
  public logPaste(
    interactionModality: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    clipboardContent: string,
  ) {
    const payload = {};
    payload[this.TYPE] = 'PASTE';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.CLIPBOARD_CONTENT] = clipboardContent;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log if a word is pasted
   *
   * @param interactionModality - indicates whether it was performed with the keyboard or the mouse
   * @param interactionSource - indicates whether it was performed with the hotkey or the context menu
   * @param segmentTextOld - the segment before the undo operation
   * @param segmentTextNew - the segment after the undo operation
   */
  public logCut(
    interactionModality: InteractionModality,
    interactionSource: InteractionSource,
    segmentTextOld: string,
    segmentTextNew: string,
    clipboardContent: string
  ) {
    const payload = {};
    payload[this.TYPE] = 'CUT';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.INTERACTION_SOURCE] = InteractionSource[interactionSource];
    payload[this.SEGMENT_TEXT_OLD] = segmentTextOld;
    payload[this.SEGMENT_TEXT_NEW] = segmentTextNew;
    payload[this.CLIPBOARD_CONTENT] = clipboardContent;

    this.sendRequest(this.highLevelURL, payload);
  }

  /**
   * Used to log when a segment was saved
   *
   * @param savedSegmentText - the saved text
   * @param interactionModality - indicates whether it was performed with the keyboard or the mouse
   */
  public logSave(savedSegmentText, interactionModality: InteractionModality) {
    const payload = {};
    payload[this.TYPE] = 'SAVE';
    payload[this.INTERACTION_MODALITY] = InteractionModality[interactionModality];
    payload[this.INTERACTION_SOURCE] = InteractionSource[InteractionSource.UI];
    payload[this.SEGMENT_TEXT] = savedSegmentText;

    this.sendRequest(this.highLevelURL, payload);
  }

  private sendRequest(url, payload) {
    // console.log('<< SENT POST to ' + url + ': ' + payload['type']);

    payload[this.TIMESTAMP] = Date.now();

    for (const key of Object.keys(this.generalInfo)) {
      payload[key] = this.generalInfo[key];
    }
    if (payload[this.INTERACTION_MODALITY] === InteractionModality[InteractionModality.MIDAIRGESTURES]) {
      // do not log, it will flood the browser
      // console.log(payload[this.TYPE]);
    } else {
      console.log(JSON.stringify(payload));
    }

    this.httpClient
      .post(url, payload, this.httpOptions)
      .subscribe
      /* result => {
        console.log('<< SENT POST to ' + url + ': ' + payload[this.TYPE]);
      } */
      ();
  }
}
