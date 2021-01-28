import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SpanService } from '../span/span.service';
import { UndoRedoService } from '../undo-redo/undo-redo.service';
import speechToText from 'watson-speech/speech-to-text';
import $ from 'jquery';
import { InteractionModality } from '../../model/InteractionModality';
import { SegmentDetailComponent } from '../../components/segment-detail/segment-detail.component';
import { LogService } from '../log/log.service';
import { InteractionSource } from '../../model/InteractionSource';
import { CapitalizationService } from '../capitalization/capitalization.service';
import {ConfigService} from '../config/config.service';

@Injectable({
  providedIn: 'root'
})

export class SpeechService {

  private static component: SegmentDetailComponent;
  private baseURL = getBaseLocation();
  private spanID;
  private interactionType: InteractionModality = InteractionModality.SPEECH;
  private speechFlag = false;
  private getSynonymsJSON = '';
  private getCommandJSON = '';
  private deleteWords = [];
  private stream;
  private replaceAux;
  private rawCommand;
  private insertEndFlag = false;
  private deleteEndFlag = false;
  private END_PLACEHOLDER;
  private WORD;
  private END_IDENTIFIER;
  private selectedText = '';
  private words;
  private count;
  private sentenceArray;
  private singleWordCommands = [];
  speechTimeout = null;
  private httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' })
  };

  constructor(private httpClient: HttpClient, private undoRedoService: UndoRedoService,
              private logService: LogService, private spanService: SpanService,
              private capitalizationService: CapitalizationService, private configService: ConfigService) {
  }
/**
 * This method is called to register a component of type SegmentDetailComponent.
 * @param segmentDetailComponent : The type of component is SegmentDetailComponent
 */
  public static registerComponent(segmentDetailComponent: SegmentDetailComponent): void {
    this.component = segmentDetailComponent;
  }

  /**
   * This function should be called whenever the view changed, on undo/redo operation etc., so that the data model is updated.
   */
  private static updateModel(): void {
    if (SpeechService.component) {
      SpeechService.component.selectedSegment.target = SpeechService.component.mainDiv.nativeElement.innerText;
      SpeechService.component.updateModel(SpeechService.component.mainDiv.nativeElement.innerText, true, false, true);
    }
  }

  /**
   * This function notifies about a click/touch/pen/eye tracker interaction to handle multi-modal combinations.
   */
  public notifyInteraction(interactionModality: InteractionModality, position: string) {
    this.spanID = position;
    this.interactionType = interactionModality;
  }
  /**
   * This function unnotifies about a click/touch/pen/eye tracker interaction by setting the spanID to undefined when the Interaction source is not InteractionSource.MAIN.
   * @param interactionModality : Type of interaction
   */
  public unNotifyInteraction(interactionModality: InteractionModality) {
    this.spanID = undefined;
    this.interactionType = interactionModality;
  }
  /**
   * This function loads synonyms and language files
   */
  loadJSONs() {
    this.getSynonymsJSON = this.baseURL + '/getSynonymsJSON_' + this.configService.speechLanguage;
    this.getCommandJSON = this.baseURL + '/getCommandsJSON';
  }

  /**
   * This is a wrapper method that loads JSONs and calls the speech service.
   * */
  callIbmSpeechClient() {
    if (this.speechFlag) {
      this.loadJSONs();
      this.runSpeech(this.getCommandJSON, this.getSynonymsJSON, this.configService.speechLanguage);
    }
  }

  /**
   * This method enables/disables speech based on the useSpeech value.
   * @param useSpeech : Boolean value for enabling or disabling speech
   */
  enableDisableSpeech(useSpeech: boolean) {
    this.speechFlag = useSpeech;
    if (!useSpeech) {
      this.stream.end();
    } else {
      this.callIbmSpeechClient();
    }
  }

  /**
   * This is the main method of speech service which generates transcriptions from audio and calls the executeCommand method.
   * @param getCommandsJson : commands.json file
   * @param getSynonymJson : synonyms_de-DE.json file
   * @param language : Target language
   */
  async runSpeech(getCommandsJson: string, getSynonymJson: string, language: string) {
    await fetch('http://localhost:3002/api/speech-to-text/token').then((response) => {
      return response.json();
    }).then((token) => {
      console.log('token is', token);
      const configuration = {
        objectMode: true, // send objects instead of text
        model: language + '_BroadbandModel',
        smart_formatting: true,
        format: true,
        continuous: true,
        backgroundAudioSuppression: 0.5,
        processingMetrics: true,
        processingMetricsInterval: 1.0,
        inactivity_timeout: 3600
      };
      // set customization if exists
      if (this.configService.speechModelCustomizationID !== null) {
        console.log('Using customization of speech model', this.configService.speechModelCustomizationID);
        configuration["customization_id"] = this.configService.speechModelCustomizationID;
      }
      this.stream = speechToText.recognizeMicrophone(Object.assign(token, configuration));


      this.stream.on('error', (err) => {
        console.log(err);
      });

      this.stream.on('data', async (data) => {
        if (data.results[0] && data.results[0].final) {
          let rawCommand = data.results[0].alternatives[0].transcript;
          rawCommand = rawCommand.trim();
          rawCommand = rawCommand.substring(0, rawCommand.length - 1); // deleting trailing '.'
          // Calls the executeCommand method which performs the speech based operations
          await this.executeCommand(rawCommand, getCommandsJson, getSynonymJson, language);
        }
      });

    }).catch((error) => {
      console.log(error);
    });
  }

  /**
   * This method processes the speech command, applies command correction to it and
   * passes it to pattern_based_operations method to match the command with the existing command rules and finally updates the results
   * updates the result in the segment as well calls the updateModel method
   * @param rawCommand = raw query command
   * @param getCommandsJson = commands rules saved in a JSON file at server.
   * @param getSynonymJson = synonym file saved in a JSON file at server
   * @param language = target language
   */
  async executeCommand(rawCommand: string, getCommandsJson: string, getSynonymJson: string, language: string) {
    if (getSynonymJson.length === 0) {
      const baseURL = getBaseLocation();
      getSynonymJson = baseURL + '/getSynonymsJSON_' + language;
    }
    const myRequest = new Request(getSynonymJson);
    const data = await fetch(myRequest).then((resp) => {
      return resp.json();
    });
    document.getElementById('warning').innerHTML = '';
    document.getElementById('microphone').innerHTML = rawCommand;
    const mainDiv = $('#mainDiv');
    let isAll;
    let operation;
    rawCommand = rawCommand.trim();
    console.log('Original command' + rawCommand);
    rawCommand = rawCommand.replace(new RegExp(String.fromCharCode(160), 'g'), ' ');
    if (rawCommand.endsWith('.')) { // deleting end marker in the query command
      rawCommand = rawCommand.substring(0, rawCommand.length - 1);
    }
    const syn = data.operations;
    this.sentenceArray = data.keywords.sentence;
    let gotOperation = this.getValueIndex([rawCommand.toLowerCase()], syn);
    if (gotOperation.index === -1) {
      const rawCommandArray = SpanService.tokenizeString(rawCommand).filter(word => word !== ' ');
      gotOperation = this.getValueIndex([rawCommandArray[0].toLowerCase()], syn);
      if (gotOperation.index === -1) {
      gotOperation = this.getValueIndex([(rawCommandArray[0]+rawCommandArray[1]).toLowerCase()], syn);
      if (gotOperation.index !== -1) {
      rawCommand = rawCommand.replace(rawCommandArray[0],'');
      rawCommand = rawCommand.replace(rawCommandArray[1],rawCommandArray[0]+rawCommandArray[1]);
        }
      }
    }
    if (gotOperation.value === 'undo') {
      const event = {'speech': true};
      SpeechService.component.onUndo(false, event);
      SpeechService.updateModel();
      this.rawCommand = rawCommand.toLowerCase();
    } else if (gotOperation.value === 'redo') {
      const event = {'speech': true};
      SpeechService.component.onRedo(false, event);
      SpeechService.updateModel();
      this.rawCommand = rawCommand.toLowerCase();
    } else if (gotOperation.value === 'confirm') {
      const event = {'speech' : true};
      SpeechService.updateModel();
      SpeechService.component.confirmSegment(InteractionModality.SPEECH);
      this.rawCommand = rawCommand.toLowerCase();
    }
    let inputText = document.getElementById('mainDiv').innerText;
    let entity = '';
    let correctedCommand;
    let commandAnalysis;
    let mmCharpos = -1;
    let isMM = false;

    if (window.getSelection().toString().length > 0) {
      this.selectedText = window.getSelection().toString();
      entity = this.selectedText;
    }

    // multimodal Single command e.g., lösche
    // tslint:disable-next-line:max-line-length
    this.words = data.keywords.words;
    if (rawCommand.indexOf(' ') < 0 && (gotOperation.value !== 'undo' && gotOperation.value !== 'redo' && gotOperation.value !== 'confirm') || rawCommand.indexOf(' ') > 0  && rawCommand.includes(this.words) && gotOperation.value === 'delete') { // example lösche + multimodal input
      if (typeof (this.spanID) !== 'undefined' && entity === '') {
        entity = document.getElementById(this.spanID).innerText;
        isMM = true;
      }
      // pass this along with command
      if (entity === '') {
        const mm = await this.multimodalEntity(gotOperation.value);
        console.log('3', gotOperation.value);
        isMM = mm.Modality;
        entity = mm.Entity;
        mmCharpos = mm.Cursor;
        entity = entity.trim();
        console.log('correction multimodal' + entity);
        if (rawCommand.includes(this.words)) {
          const array = SpanService.tokenizeString(rawCommand).filter(word => word !== ' ');
          const object = data.number;
          entity = entity + this.getValueIndex([array[1]], object).value + array[2];
        }
        console.log('Entity is', entity);
      }
      correctedCommand = [gotOperation.value, entity];
      commandAnalysis = {
        corrected_command: correctedCommand,
        operation_to_perform: gotOperation.value, operation_index: gotOperation.index, countOperation: 0, X: entity, Y: '', Z: ''
      };
    } else {
      if (rawCommand.includes(this.words) && entity === '') {
        const mm = await this.multimodalEntity(operation);
        console.log('4', operation);
        isMM = mm.Modality;
        entity = mm.Entity;
        mmCharpos = mm.Cursor;
        entity = entity.trim();
        const array = SpanService.tokenizeString(rawCommand).filter(word => word !== ' ');
        const object = data.number;
        entity = entity + this.getValueIndex([array[1]], object).value + array[2];
        rawCommand = rawCommand.replace(this.words, '').replace(array[1] , entity);
        console.log('The rawCommand is:', rawCommand);
      }
      const receivedCorrection = await this.commandCorrection(rawCommand.split(' '), getSynonymJson, language, data);
      correctedCommand = receivedCorrection.corrected_command.trim().split(' ');
      isAll = receivedCorrection.countOperation;
      operation = receivedCorrection.operation_to_perform;
      commandAnalysis = receivedCorrection;
    }
    console.log('corrected: ' + correctedCommand, entity);
    const puncRegexRep = /([.,!":])/g;
    const puncRegex = /\s+([.,!":])/g;
    inputText = inputText.split(puncRegexRep).join(' '); // Tokenization
    let result = '';
    // Check if inputText and isMM value is correct.
    const finalResult = await this.pattern_based_operations(inputText, correctedCommand, getCommandsJson,
      getSynonymJson, language, mmCharpos, isMM, commandAnalysis);
    result = finalResult.Result;
    const operationType = finalResult.Operation;
    entity = finalResult.Entity;
    console.log('gotResult in executeCommand method', result, 'entity', entity);
    this.logService.logSpeechInput(rawCommand, correctedCommand, operationType, entity,
    SpeechService.component.mainDiv.nativeElement.innerText);
    result = result.replace(/\s+/g, ' ').trim();
    result = result.replace(puncRegex, '$1');
    result = result.replace(/ +(?= )/g, '');
    console.log('result: ' + result);
    const resultArray = SpanService.tokenizeString(result).filter(word => word !== ' ');
    const inputTextArray = SpanService.tokenizeString(inputText).filter(word => word !== ' ');
    const div = document.getElementById('mainDiv');
    if (operation === 'delete' && isAll === 10000) {
      div.innerText = '';
      result = '';
      SpanService.initDomElement(result, mainDiv, false);
      SpeechService.updateModel();
    } else if (JSON.stringify(inputTextArray) !== JSON.stringify(resultArray)) {
      console.log('Entered the else if block');
      div.innerText = '';
      SpanService.initDomElement(result, mainDiv, false);
      SpeechService.updateModel();
    }
    console.log('listening... ' + correctedCommand);
  }

/**
 * Wrapper method and calls executeCommand when speech command is selected from the dropdown menu
 */
  async command(getCommandsJson: string, getSynonymJson: string) {
    this.loadJSONs();
    const dropdownEl: HTMLFormElement = document.getElementById('command') as HTMLFormElement;
    let command: string = dropdownEl.options[dropdownEl.selectedIndex].value;
    console.log('The command is', command);
    command = command.trim();
    await this.executeCommand(command, this.getCommandJSON, this.getSynonymsJSON, this.configService.speechLanguage);
  }

  /**
   * Given a tokenized list of words and a data dictionary (operations, number, keywords, preposition, conjunction, count or punctuation), it returns the key
   * and the index in the wordlist that matches the key to be returned.
   * @param wordList = commands
   * @param dataDic = synonym file
   *
   */
  getValueIndex(wordList, dataDic) {
    // tslint:disable-next-line:forin
    for (const i in dataDic) {
            const key = i;
            const val = dataDic[i];
            for (let j = 0; j < val.length; j++) {
              for (let k = 0; k < wordList.length; k++) {
              if (val[j] === wordList[k].toLowerCase()) {
                console.log('the key to be returned', key, k);
                return { value: key, index: k };
                }
              }
            }
          }
    return {value: '', index: -1};
  }

  /**
   * This function takes the entire string and the position (cursor/multimodal touch or pen) and return
   * the corresponding word on that position.
   * @param str - the entire text
   * @param pos - the cursor position
   */
  async getWordAtPCursorPosition(str, pos) {
    if (window.getSelection().toString().length > 0) {
     return window.getSelection().toString();
    }
    if (str.charAt(pos).trim().length === 0) {
      pos = pos - 1;
    }
    // Perform type conversions.
    str = String(str);
    pos = Number(pos);

    // Search for the word's beginning and end.
    const left = str.slice(0, pos + 1).search(/\S+$/);
    const right = str.slice(pos).search(/\s/);

    // The last word in the string is a special case.
    if (right < 0) {
      return str.slice(left);
    }

    // Return the word, using the located bounds to extract it from the string.
    return str.slice(left, right + pos);

  }

  /**
   * The function takes the command as list of words and capitalize Nouns, convert operations to a machine acceptable name
   * such as lösche --> delete, entferne --> delete
   * @param wordList = query command as a list
   * @param getSynonymsJson = JSON file
   * @param language = target language
   */
  async commandCorrection(wordList, getSynonymsJson, language, data) {

    let command = wordList.join(' ');
    const opDic = data.operations;
    this.count = data.count;
    const operation = this.getValueIndex(wordList, opDic); // identify operation type
    let count = 0;
    let mm;
    let entityX = '';
    let entityY = '';
    let entityZ = ''; // only for between x between y and z
    const prep = data.preposition; // Synonym for preposition e.g., "vor": "before", "danach": "after".
    let i;
    wordList = command.split(' ');
    command = '';
    for (i = 0; i < wordList.length; i++) {
      if (this.capitalizationService.isNoun(wordList[i].toLowerCase())) {
        command += this.capitalizationService.nounify(wordList[i].toLowerCase()) + ' ';
      } else if (this.capitalizationService.isNoun(wordList[i])) {
        command += this.capitalizationService.nounify(wordList[i]) + ' ';
      } else {
        command += wordList[i] + ' ';
      }
    }
    command = command.trim();
    wordList = command.split(' ');
    // Insert
    if (operation.value === 'insert') {
      const extra_words = data.operations.insert;
      const commandTokens = SpanService.tokenizeString(command).filter(word => word !== ' ');
      const lastToken = commandTokens[commandTokens.length-1];
      for (let i = 0; i < extra_words.length; i++) {
      if (lastToken === extra_words[i].split(" ")[1]) {
      command = command.substring(0,command.lastIndexOf(" ")).trim(); // remove 'ein'
    }
  }
      const mm = await this.multimodalEntity(operation);
      console.log('5', operation); // Getting multimodal entity (the word need to be replaced)
    }
    if (wordList[1] !== undefined) {
    count = parseInt(this.getValueIndex([wordList[1].toLowerCase()], data.count).value);
    if (this.getValueIndex([wordList[1].toLowerCase()], data.count).value === 'last') {
      count = -1;
    } else if (isNaN(count)) {
      count = undefined;
    } // count e.g., "erstes": 1, "erstem": 1,"zweites": 2.
    if (count !== undefined) {
      command = command.replace(wordList[operation.index + 1], wordList[operation.index + 1].toLowerCase());
    }
  }
    // multimodal Replace
    const preposition = this.getValueIndex(wordList, prep);
    const mainPrep = data.preposition;
    const mainPrepIndex = wordList.indexOf(mainPrep.by[1]);
    if (operation.value === 'replace' && preposition.value === 'by' &&  mainPrepIndex === 1) {
      console.log('command correction multimodal ' + command);
      mm = await this.multimodalEntity(operation);
      console.log('6', operation); // Getting multimodal entity (the word need to be replaced)
      if (mm.Modality) {
        entityX = mm.Entity;
        if (preposition.index === wordList.length) { // ersetze y mit
          for (i = operation.index + 1; i < wordList.length - 1; i++) {
            entityY += wordList[i] + ' ';
          }
        } else {
          for (i = operation.index + 2; i < wordList.length; i++) {
            entityY += wordList[i] + ' ';
          }
        }
        entityY = entityY.trim();
        command = operation.value + ' ' + entityX;
        for (i = operation.index; i < wordList.length; i++) {
          command += ' ' + wordList[i];
        }
      }
    }
    // multimodal Move
    if (operation.value === 'move'
      && (prep[wordList[operation.index + 1]] === 'before'
        || prep[wordList[operation.index + 1]] === 'after'
        || prep[wordList[operation.index + 1]] === 'between')) {
      console.log('command correction multimodal' + command);
      const mm = await this.multimodalEntity(operation);
      console.log('7', operation.value);
      if (mm.Modality) {
        entityX = mm.Entity;
        if (prep[wordList[operation.value + 1]] === 'before'
          || prep[wordList[operation.index + 1]] === 'after') {
          for (i = operation.index + 2; i < wordList.length; i++) {
            entityY += wordList[i] + ' ';
          }
        } else {
          entityY += wordList[operation.index + 2];
          entityZ += wordList[operation.index + 4];
        }
        console.log('command correction multimodal' + entityX);
        command = wordList[operation.value] + ' ' + entityX;
        for (i = operation.index + 1; i < wordList.length; i++) {
          command += ' ' + wordList[i];
        }
      }
    }

    return {
      corrected_command: command.trim(),
      operation_to_perform: operation.value, operation_index: operation.index,
      countOperation: count, X: entityX, Y: entityY, Z: entityZ
    };
  }

  /**
   * Allowing Multimodal indication, this function returns touched/pointing out/cursor/selection word(s) as X.
   */
  async multimodalEntity(operation) {
    let count = 0;
    const currText = document.getElementById('mainDiv').innerText;
    const cursor = await SpanService.getCursorPosDiv('mainDiv');
    console.log('cursor4', cursor);
    if (cursor.begin === -2 || cursor.end === -2) {
      return {
        Entity: '',
        Count: 0,
        Modality: false,
        Cursor: -2
      };
    }
    if (cursor.begin === -1 || cursor.end === -1) {
      // use other cursor function
      cursor.begin = SpanService.cursorSelection.startChar;
      cursor.end = SpanService.cursorSelection.endChar;
      console.log('cursorIn', cursor);
    }
    console.log('cursorOut', cursor);
    const entity = await this.getWordAtPCursorPosition(currText, cursor.begin);
    console.log('multimodal: ' + entity);
    // set count
    const re = new RegExp('(?:^|\\s)' + entity + '(?:^|\\s)', 'i');
    const tmp = currText.substring(0, cursor.begin + entity.length);
    if (tmp.match(re) !== null) {
      count = tmp.match(re).length;
    }
    const charPos = cursor.begin;
    const modality = true;
    if (operation !== '' && operation !== undefined) {
    this.logService.logSpeechMultiModalEntity(this.interactionType, entity, currText); }
    return {
      Entity: entity,
      Count: count,
      Modality: modality,
      Cursor: charPos
    };
  }

  /**
   *
   * @param wordList = query command
   * @param getSynonymsJson = Synonym file
   * @param language = language information
   * @param commandAnalysis = pre-analyze command -an object type contains operation_to_perform, pre-identified x if
   * it is multimodal entity.
   * The function returns all the rest analysis to extract/create pattern, it provides,
   * 1. which operation to be performed.
   * 2. Value of X, Y, and Z
   * 3. Which X, which Y.
   * 4. Preposition type and conjunction
   */
  async identifyOperations(wordList, getSynonymsJson, language, commandAnalysis) {
    let operation;
    let preposition;
    let conjunction;
    let opPosition;
    let pPosition;
    let count;
    let punctuation = '';
    let yCount = 0;
    let entityX;
    let entityY;
    let entityZ = '';
    let yCountPos = 0;
    let isMultimodal = false;
    let xCursor = -1;
    let yCursor = -1;
    const myRequest = new Request(getSynonymsJson);
    const data = await fetch(myRequest).then((resp) => {
      return resp.json();
    });
    let identifier = '';
      identifier += wordList[wordList.length- 1].toLowerCase();
    const punc = data.punctuation;
    const countJson = data.count;
    this.END_PLACEHOLDER = identifier;
    this.END_IDENTIFIER = data.count.end;
    this.WORD = data.keywords.word;
    const replacePrimaryPrep = data.preposition.by;
    let replaceAuxPrep  = [];
    replaceAuxPrep.push(data.preposition.before);
    replaceAuxPrep.push(data.preposition.after);
    replaceAuxPrep = [].concat.apply([], replaceAuxPrep);
    this.singleWordCommands.push(data.operations.confirm);
    this.singleWordCommands.push(data.operations.undo);
    this.singleWordCommands.push(data.operations.redo);
    this.singleWordCommands = [].concat.apply([], this.singleWordCommands);
    let i;
    const length = wordList.length;
    // check operation
    let prep = data.preposition;
    let inputAuxPrep = [];
    let referenceWord = '';
    operation = commandAnalysis.operation_to_perform;
    if (operation === 'replace') {
      const prepositionReplace = wordList.filter(value => replacePrimaryPrep.includes(value));
      prep = { preposition: 'pattern' };
      prep[prepositionReplace] = 'by';
      inputAuxPrep = wordList.filter(value => replaceAuxPrep.includes(value));
    }
    opPosition = commandAnalysis.operation_index;
    entityX = commandAnalysis.X;
    if (inputAuxPrep.length !== 0) {
      if (inputAuxPrep[0] === replaceAuxPrep[0] || inputAuxPrep[0] === replaceAuxPrep[1]) {
        this.replaceAux = 'before';
      }
      if (inputAuxPrep[0] === replaceAuxPrep[2] || inputAuxPrep[0] === replaceAuxPrep[3] || inputAuxPrep[0] === replaceAuxPrep[4]) {
        this.replaceAux = 'after';
      }
      // A bunch of words could be present before auxillary preposition
      for (let k = 1; k < wordList.indexOf(inputAuxPrep[0]); k++) {
        entityX += wordList[k] + ' ';
      }
      entityX = entityX.trim();
      // Similarly, a bunch of words could be present after the auxillary preposition and before the main preposition
      let prepIndex = wordList.indexOf(data.preposition.by[1]);
      if (prepIndex === -1) {
        prepIndex = wordList.indexOf(data.preposition.by[2]);
      }
      for (let b = wordList.indexOf(inputAuxPrep[0]) + 1; b < prepIndex; b++) {
        referenceWord += wordList[b] + ' ';
      }
      referenceWord = referenceWord.trim();
      const splitArray = referenceWord.split(' ');
      yCount = parseInt(this.getValueIndex([splitArray[0]],countJson).value);
      if (this.getValueIndex([splitArray[0]],countJson).value === 'last') {
        yCount = -1;
      } else if (isNaN(yCount)){
        yCount = undefined;
      }
      if (yCount !== undefined ) {referenceWord = splitArray[1];
      }
    }
    entityY = commandAnalysis.Y;
    if (operation !== 'insert' && count === undefined) {
      opPosition = 0;
      count = parseInt(this.getValueIndex([wordList[1]],countJson).value);
      if ( this.getValueIndex([wordList[1]],countJson).value === 'last') {
        count = -1;
      } else if (isNaN(count)) {
        count = undefined;
      }
    }
    if (operation === 'move' && wordList.indexOf(data.preposition.by[2]) !== -1) {
      wordList[wordList.indexOf(data.preposition.by[2])] = 'dummy';
     }
    const conj = data.conjunction;
    const prepOut = this.getValueIndex(wordList, prep);
    preposition = prepOut.value;
    pPosition = prepOut.index;
    conjunction = this.getValueIndex(wordList, conj);
    if (wordList.indexOf('dummy') !== -1) {
      wordList[wordList.indexOf('dummy')] = data.preposition.by[2];
    }
    if (operation === 'replace' && (wordList.indexOf(data.preposition.by[1]) !== -1 || wordList.indexOf(data.preposition.by[2]) !== -1)) {
      preposition = 'by';
      pPosition = wordList.indexOf(data.preposition.by[1]);
      if (pPosition === -1) {
        pPosition = wordList.indexOf(data.preposition.by[2]);
      }
    }
    // Delete operation cannot have preposition by
    if ((operation === 'delete' && preposition === 'by')) {
      preposition = '';
      pPosition = -1;
    }
    // tslint:disable-next-line:max-line-length
    // Multimodal entityX is set incorrectly sometimes. This is to ensure that does not happen. If ["ersetze", "durch", "Test"] is the wordlist, then multimodal makes sense. Not otherwise.
    if (entityX !== '' && operation === 'replace' && !wordList[1].includes(data.preposition.by[1]) && inputAuxPrep.length === 0) {
      entityX = '';
    }
    if (entityX === '') {
      let startIndex;
      let endIndex;
      if (count === undefined) {
        startIndex = opPosition + 1;
      } else {
        startIndex = opPosition + 2;
      }
      if (pPosition > opPosition) { // preposition exist: example "delete 2nd 'the'/ 'the house' before 'near'"
        endIndex = pPosition;
      } else { // preposition does not exist: example "delete 2nd 'the'/ 'the house'"
        endIndex = length;
      }
      for (i = startIndex; i < endIndex; i++) {
        entityX += wordList[i] + ' ';
      }
    }
    // In cases where durch is in the preposition. entityX and entityY needs to be set properly.
    if (operation === 'replace' && entityX.includes(data.preposition.by[1])) {
      const z = entityX.substring(0, entityX.indexOf(data.preposition.by[1]) - 1);
      entityY = entityX.substring(entityX.indexOf(data.preposition.by[1]) + 5, entityX.length);
      entityX = z;
    }
    if (entityY === '') {
      let startIndex;
      let endIndex;
      if (pPosition !== -1) {
        if (conjunction.index === -1) {
          startIndex = pPosition + 1;
          endIndex = length;
        } else { // if preposition is between the conjunction will be and
          startIndex = pPosition + 1;
          endIndex = conjunction.index;
        }
        // check for ycount example delete x before first y
        if (this.getValueIndex([wordList[startIndex].toLowerCase()], countJson).value === 'last') {
          yCount = -1;
          yCountPos = startIndex;
          startIndex = startIndex + 1;
        } else if (!isNaN(parseInt(this.getValueIndex([wordList[startIndex].toLowerCase()], countJson).value))) {
          yCount = parseInt(this.getValueIndex([wordList[startIndex].toLowerCase()], countJson).value);
          yCountPos = startIndex;
          startIndex = startIndex + 1;
        }
        for (i = startIndex; i < endIndex; i++) {
          entityY += wordList[i] + ' ';
        }
      }
    }
    if (referenceWord.length !== 0) {
      entityZ = entityY;
      entityY = referenceWord;
    }
    let entityA = '';
    if (entityZ === '') {
      if (conjunction.index !== -1 && conjunction.index !== ((wordList.indexOf(data.preposition.between[1]) + 1) || (wordList.indexOf(data.preposition.between[0])))) {
        if (operation === 'replace') {
          for (i = conjunction.index + 1; i < wordList.indexOf(data.preposition.by[1]); i++) {
            entityZ += wordList[i] + ' ';
          }
          if (entityX.indexOf(data.preposition.between[1]) !== -1) {
            entityX = '';
            for (i = 1; i < wordList.indexOf(data.preposition.between[1]); i++) {
              entityX += wordList[i] + ' ';
            }
          }
          if (entityY === '') {
            for (i = wordList.indexOf(data.preposition.between[1]) + 1; i < conjunction.index; i++) {
              entityY += wordList[i] + ' ';
            }
          }
          for (i = wordList.indexOf(data.preposition.by[1]) + 1; i < length; i++) {
            entityA += wordList[i] + ' ';
          }
        } else {
        for (i = conjunction.index + 1; i < length; i++) {
          entityZ += wordList[i] + ' ';
        }
      }
    } else if (conjunction.index !== -1 && conjunction.index !== wordList.lastIndexOf(data.conjunction.and[0])) {
        for (i = wordList.indexOf(data.preposition.between[1]) + 1; i < wordList.lastIndexOf(data.conjunction.and[0]); i++) {
          entityY += wordList[i] + ' ';
        }
        for (i = wordList.lastIndexOf(data.conjunction.and[0]) + 1; i < length; i++) {
          entityZ += wordList[i] + ' ';
        }
      }
    }
    entityX = entityX.trim();
    entityY = entityY.trim();
    entityZ = entityZ.trim();
    entityA = entityA.trim();
    // check punctuations
    if (this.getValueIndex([entityX], punc).index !== -1) { // if X is punctuation
      entityX = this.getValueIndex([entityX], punc).value;
      punctuation = entityX;
    } else if (this.getValueIndex([entityX.toLowerCase()], punc).index !== -1) {
      entityX = this.getValueIndex([entityX.toLowerCase()], punc).value;
      punctuation = entityX;
    }

    if (this.getValueIndex([entityY], punc).index !== -1) { // if Y is punctuation
      entityY = this.getValueIndex([entityY], punc).value;
      punctuation = entityY;
    } else if (this.getValueIndex([entityY.toLowerCase()], punc).index !== -1) {
      entityY = this.getValueIndex([entityY.toLowerCase()], punc).value;
      punctuation = entityY;
    }

    if (this.getValueIndex([entityZ], punc).index !== -1) { // if Z is punctuation
      entityZ = this.getValueIndex([entityZ], punc).value;
      punctuation = entityZ;
    } else if (this.getValueIndex([entityZ.toLowerCase()], punc).index !== -1) {
      entityZ = this.getValueIndex([entityZ.toLowerCase()], punc).value;
      punctuation = entityZ;
    }
    if (entityX === '') { // Multimodal if X unavailable
      const mm = await this.multimodalEntity(operation);
      console.log('1', operation);
      count = mm.Count;
      entityX = mm.Entity;
      isMultimodal = mm.Modality;
      xCursor = mm.Cursor;
    }
    // tslint:disable-next-line:max-line-length
    if (entityY === '' && operation !== 'delete') { // Multimodal if Y unavailable. But does not hold good for delete operation.
      if (preposition === 'at' && identifier === this.END_IDENTIFIER) {
        // pass
      } else {
        const mm = await this.multimodalEntity(operation);
        console.log('2', operation);
        isMultimodal = mm.Modality;
        yCount = mm.Count;
        entityY = mm.Entity;
        yCursor = mm.Cursor;
      }
    }

    if (typeof (conjunction) === 'undefined') {
      conjunction = '';
    }
    if (typeof (punctuation) === 'undefined') {
      punctuation = '';
    }
    if (typeof (preposition) === 'undefined') {
      preposition = '';
    }
    if (typeof (count) === 'undefined') {
      count = 0;
    }
    if (preposition === 'at' && entityX.toLowerCase() === this.WORD && this.END_IDENTIFIER.includes(identifier)) {
      entityX = this.END_PLACEHOLDER;
    } else if (preposition === 'at' && this.END_IDENTIFIER.includes(identifier) && operation === 'insert') {
      this.insertEndFlag = true;
    } else if (preposition === 'at' && this.END_IDENTIFIER.includes(identifier) && operation === 'delete') {
      this.deleteEndFlag = true;
    } else {
      this.END_PLACEHOLDER = '';
    }
    console.log([operation, entityX, entityY, entityZ, count, yCount, preposition, conjunction, xCursor, yCursor]);
    return {
      Operation: operation,
      OpPosition: opPosition,
      Preposition: preposition,
      Conjunction_value: conjunction.value,
      GroupPosition: pPosition,
      Count: count,
      Ycount: yCount,
      Punctuation: punctuation,
      X: entityX,
      Y: entityY,
      Z: entityZ,
      A: entityA,
      Multimodal: isMultimodal,
      CursorX: xCursor,
      CursorY: yCursor,
      conjunction_index: conjunction.index
    };
  }

  /**
   * The function returns required information after validating pattern from command.json
   * @param createdPattern = the pattern created from the above function which will be validated from command.json
   * @param getCommandsJson = command.json file
   * @param wordList = specific word list extracted from query command
   *
   */
  async matchPattern(createdPattern, getCommandsJson, wordList) {
    let command;
    const myRequest = new Request(getCommandsJson); // multi language support
    const data = await fetch(myRequest).then((resp) => {
      return resp.json();
    });
    // prepare fet pattern
    // füge [\w+\s]+ nach erstem \w+ ein
    if (data[createdPattern]) {
      data[createdPattern].entity = wordList[0];
      data[createdPattern].count = wordList[1];
      data[createdPattern].wordY = wordList[2];
      data[createdPattern].wordZ = wordList[3];
      data[createdPattern].wordA = wordList[4];
      data[createdPattern].ycount = wordList[5];
      command = {
        operation: data[createdPattern].operation,
        X: data[createdPattern].entity,
        CountX: data[createdPattern].count,
        Y: data[createdPattern].wordY,
        Z: data[createdPattern].wordZ,
        A: data[createdPattern].wordA,
        Preposition: data[createdPattern].preposition,
        CountY: data[createdPattern].ycount,
        cursorX: wordList[6],
        cursorY: wordList[7],
        message: true
      };
    } else {
      command = {
        operation: '', X: wordList[0],
        CountX: wordList[1], Y: wordList[2], Z: wordList[3],
        Preposition: '', CountY: wordList[4],
        cursorX: wordList[5], cursorY: wordList[6],
        message: false
      };
    }
    return command;
  }

  /**
   * The function returns the resultant text after performing operation queried by the user through command.
   * @param inputText = The raw MT text to be post-edited.
   * @param command = Corrected command
   * @param getCommandsJson = command.json
   * @param getSynonymsJson = Synonym.json
   * @param language = language information
   * @param mmCursor = multimodal cursor position
   * @param isMM = whether the quey contains multimodal activities or not
   * @param commandAnalysis = object, contains analytical information of the query command.
   */
  async pattern_based_operations(inputText, command, getCommandsJson, getSynonymsJson, language, mmCursor, isMM,
                                 commandAnalysis) {
    let result = '';
    const tmp = await this.identifyOperations(command, getSynonymsJson, language, commandAnalysis);
    const operation = commandAnalysis.operation_to_perform;
    let x;
    if (commandAnalysis.X !== '') {
      x = commandAnalysis.X;
    } else {
      x = tmp.X;
    }
    const conjunction = tmp.Conjunction_value;
    const preposition = tmp.Preposition;
    let createPattern = '';
    const isMultimodal = tmp.Multimodal || isMM;
    const y = tmp.Y;
    const z = tmp.Z;
    let entity = tmp.X;
    const a = tmp.A;
    const yCount = tmp.Ycount; // e.g., delete X before second Y
    const opCount = tmp.Count; // e.g., delete second X
    const xCursor = mmCursor;
    const yCursor = mmCursor;
    const puncRegexRep = /([.,!":])/g;
    if (tmp.Punctuation !== '') {
      entity = tmp.Punctuation;
      inputText = inputText.split(puncRegexRep).join(' '); // Tokenization
      console.log(inputText);
    }
    if (x.trim() !== '') {
      x = x.trim();
      createPattern = operation;
      if (opCount !== 0) {
        createPattern += ' count x';
      } else {
        createPattern += ' x';
      }
      if (operation === 'replace' && z !== '' && a !== '') {
      createPattern += ' ' + 'between' + ' y ' + conjunction + ' z ' + preposition + ' a ';
      } else if (operation === 'replace' && yCount > 0) {
        createPattern += ' ' + this.replaceAux + ' ' + 'yCount' + ' y ' + preposition + ' z';
    } else if (operation === 'replace' && z !== '' && a === '') {
        createPattern += ' ' + this.replaceAux + ' y ' + preposition + ' z';
      } else {
        // before/after
        if (preposition !== '' && y !== '' && conjunction === '') {

          if (yCount > 0) {
            createPattern += ' ' + preposition + ' yCount y';
          } else {
            createPattern += ' ' + preposition + ' y';
          }

        } else if (preposition !== '' && conjunction !== '' && y !== '' && z !== '') { // between
          createPattern += ' ' + preposition + ' y ' + conjunction + ' z';
        }
      }
      /*
      =============================================================
      Till now we have created a pattern from natural language text
      that would be matched to the pattern available in the command.json
      =============================================================
      */

      const wordList = [x, opCount, y, z, a, yCount, xCursor, yCursor];
      console.log('The created pattern is', createPattern);
      const matchedPattern = await this.matchPattern(createPattern.trim(), getCommandsJson, wordList);
      // if we have matched pattern in command.json, then we can allow to continue post-editing
      if (matchedPattern.message) {
        // delete
        if (operation === 'delete') {
          console.log(matchedPattern);
          inputText = document.getElementById('mainDiv').innerText;
          result = await this.deleteWrapper(inputText, matchedPattern, isMultimodal); // perform delete operation
        }

        // insert
        if (operation === 'insert') {
          console.log(matchedPattern);
          inputText = document.getElementById('mainDiv').innerText;
          result = await this.insertWrapper(inputText, matchedPattern, isMultimodal);

        }
        // Move
        if (operation === 'move') {
          console.log(matchedPattern);
          inputText = document.getElementById('mainDiv').innerText;
          result = await this.moveWrapper(inputText, matchedPattern, isMultimodal);
        }

        if (operation === 'replace') {
          console.log(matchedPattern);
          inputText = document.getElementById('mainDiv').innerText;
          result = await this.replaceWrapper(inputText, matchedPattern, isMultimodal);
        }

        // Reset feedback s.t. it disappears
        SpeechService.component.speechFeedback = '';
      } else {
        if (this.rawCommand !== undefined) {
        if (this.singleWordCommands.indexOf(this.rawCommand.toLowerCase()) === -1) {
        SpeechService.component.speechFeedback = 'command does not match the supported template';
        }
      }
        // NOTE: We can still perform operation if the pattern is not available but for multilingual facility
        // we must include all patterns in the command.json
        result = inputText; // false case
      }
    } else {
      if (this.singleWordCommands.indexOf(this.rawCommand.toLowerCase()) === -1) {
        SpeechService.component.speechFeedback = 'X in not identified';
      }
      result = inputText; // false case
    }
    return {
      Result: result,
      Operation: operation,
      Entity: x
    };

  }
/**
 * This is a wrapper method for delete functionality
 * @param inputText : Initial segment before applying the speech command
 * @param pattern : JSON object constructed
 * @param isMultimodal : Boolean value which determines if the command is multimodal or not
 */
  async deleteWrapper(inputText, pattern, isMultimodal) {
    const getReturn = await this.coreDelete(inputText, pattern);
    console.log('The result therefore is', getReturn.Result);
    let result = getReturn.Result;
    const indices = getReturn.Indices;
    if (result !== '' && inputText !== getReturn.Result) {
      const entity = getReturn.Entity;
      result = result.replace(/\s+/g, ' ').trim();
      this.callLog('Delete', entity, '', inputText, result.replace('<em>', '').replace('</em>', ''), indices, isMultimodal);
} else {
      result = inputText;
    }
    return result;
  }

  /**
   * This is the main delete function that supports all the commands in the commands.json file.
   * @param inputText = Initial input segment before the speech command is applied
   * @param pattern = JSON object constructed
   */
  async coreDelete(inputText, pattern) {
    let result = '';
    let retParams = {
      Entity: '', InputText: inputText, Result: result,
      Indices: [0]
    };
    const x = pattern.X;
    const countX = pattern.CountX;
    const y = pattern.Y;
    const z = pattern.Z;
    const p = pattern.Preposition;
    const yCount = pattern.CountY;
    const xCursor = pattern.cursorX;
    if (p.length === 0) { // Check whether prepositions (before, after, between) exist or not.If it doesn't exist, the condition is satisfied.
      const ret = await this.deleteEntityAtPosition(x, inputText, countX, xCursor);
      retParams = {
        Entity: ret.Entity, InputText: ret.InputText, Result: ret.Result,
        Indices: ret.Indices
      };
    } else if (p === 'p1') { // condition for before
      if (countX > 0) {
        const ret = await this.deleteEntityAtPosition(x, inputText, countX, xCursor);
        retParams = {
          Entity: ret.Entity, InputText: ret.InputText, Result: ret.Result,
          Indices: ret.Indices
        };
      } else {
        const re = new RegExp('(?:^|\\s?)' + x + '(\\s?)' + y + '(?:^|\\s)', 'i');
        let indexP1;
        let countFlag = false;
        if (yCount > 0) { // Check if yCount is greater than zero // Delete x before yCount y
          const indices = await this.getIndicesOf(y, inputText, false);
          if (indices.length < yCount) {
            document.getElementById('warning').innerHTML = y + ' at position ' + yCount + ' does not exist!';
            indexP1 = -1;
            countFlag = true;
          }
          else {
          indexP1 = indices[yCount - 1];
          indexP1 = indexP1-x.length-1;}
        } else {
          indexP1 = inputText.search(re);
        }
        const beforeString = inputText.substring(0, indexP1).trim();
        if (indexP1 !== -1) {
          if (/[.,:!?]/.test(y)) {
            result = beforeString + inputText.substring(indexP1 + x.length, inputText.length);
          } else {
            result = beforeString + '<em>' + ' ' + '</em>' + inputText.substring(indexP1 + x.length + 1, inputText.length);
          }
        } else if (countFlag !== true) {
          document.getElementById('warning').innerHTML = x + ' before '+ y + ' does not exist!';
          result = inputText;
        }
        retParams = {
          Entity: x, InputText: inputText, Result: result,
          Indices: [indexP1]
        };
      }
    } else if (p === 'p2') { // condition for after
      if (countX > 0) {
        const ret = await this.deleteEntityAtPosition(x, inputText, countX, xCursor);
        retParams = {
          Entity: ret.Entity, InputText: ret.InputText, Result: ret.Result,
          Indices: ret.Indices
        };
      } else {
        const re = new RegExp('(?:^|\\s)' + y + '(\\s?)' + x + '(?:^|\\s)', 'i');
        const indices = this.getIndicesOf(y, inputText, false);
        let index;
        let countFlag = false;
        if (yCount > 0) {
          if (indices.length < yCount) {
            document.getElementById('warning').innerHTML = y + ' at position ' + yCount + ' does not exist!';
            index = -1;
            countFlag = true;
          }
          else {
          index = indices[yCount - 1];
        }
        } else {
          index = inputText.search(re);
          if (index === -1) {
            index = inputText.search(new RegExp(y + x));
          }
        }
        if (countX > 0) { // Ex: Lösche zweites ihre nach zweites CDS.
          const ret = await this.deleteEntityAtPosition(x, inputText, countX, xCursor);
          retParams = {
            Entity: ret.Entity, InputText: ret.InputText, Result: ret.Result,
            Indices: ret.Indices
          };
        } else {
          let afterString;
          if (index !== -1) {
            if (/[.,:!?]/.test(x) && x.length === 1) {
              // tslint:disable-next-line:max-line-length
              afterString = inputText.substring(0, index + y.length) + '<em>' + ' ' + '</em>' + inputText.substring(index + y.length + x.length + 1);
            } else {
              // tslint:disable-next-line:max-line-length
              afterString = inputText.substring(0, index + y.length + 1) + '<em>' + ' ' + '</em>' + inputText.substring(index + y.length + x.length + 2);
            }
            result = afterString;
          } else if (countFlag !== true) {
            document.getElementById('warning').innerHTML = x + ' after '+ y + ' does not exist!';
            result = inputText;
          }
          retParams = {
            Entity: x, InputText: inputText, Result: result,
            Indices: [index]
          };
        }
      }
    } else if (y.length > 0 && z.length > 0) { // condition for between
      const ind1 = inputText.search(y);
      const ind2 = inputText.search(z);
      let index1 = ind1;
      let index2 = ind2;
      if (ind1 > 0 && ind2 > 0) {
        const indicesY = await this.getIndicesOf(y, inputText, false);
        const indicesZ = await this.getIndicesOf(z, inputText, false);
        index1 = indicesY[0];
        index2 = indicesZ[0];
        if (indicesY.length > 1 || indicesZ.length > 1) {
          const tmp = await this.getNearestIndices(indicesY, indicesZ);
          index1 = tmp[0];
          index2 = tmp[1];
        }

        index1 = index1 + y.length;
        if (x === inputText.substring(index1 + 1, index2 - 1)){
        result = inputText.substring(0, index1) + '<em>' + ' ' + '</em>' + inputText.substring(index2, inputText.length);
      } else {
        document.getElementById('warning').innerHTML = x + ' does not exist!';
      }
      } else if (ind2 < 0 && ind1 < 0) {
        result = '';
        document.getElementById('warning').innerHTML = y + ' and ' + z + ' does not exist!';
      } else if (ind1 < 0 && ind2 > 0) {
        result = '';
        document.getElementById('warning').innerHTML = y + ' does not exist!';
      } else if (ind1 > 0 && ind2 < 0) {
        result = '';
        document.getElementById('warning').innerHTML = z + ' does not exist!';
      }
      retParams = {
        Entity: x, InputText: inputText, Result: result,
        Indices: [index1, index2]
      };
    }
    result = retParams.Result.replace(/\s+/g, ' ').trim();
    retParams.Result = result;
    return retParams;
  }
/**
 * This method capitalizes the first word of the segment
 * @param entity : entity in the speech command
 * @param index : index at which the entity is found
 */
  private updateCapitalization(entity, index) {
    let firstWord = entity;
    if (entity.indexOf(' ') > 0) {
    const entityArray = entity.split(' ', 2);
    firstWord = entityArray[0];
    }
    if (index === 0) {
      firstWord = firstWord.charAt(0).toUpperCase() + firstWord.substr(1).toLowerCase();
      entity = entity.replace(/[^\s]*/, firstWord);
    }
    return entity;
  }
/**
 * This function is used to find the nearest indices for the between condition, given indices the two indices arrays
 * @param A : Indices array-1
 * @param B : Indices array-2
 */
  getNearestIndices(A, B) {
    let a = 0;
    let b = 0;

    // Initialize result as max value
    let result = 100000;
    let index1;
    let index2;

    // Scan Both Arrays upto
    // sizeof of the Arrays
    while (a < A.length && b < B.length) {
      if (Math.abs(A[a] - B[b]) < result) {
        result = Math.abs(A[a] - B[b]);
        index1 = A[a];
        index2 = B[b];
      }
      // Move Smaller Value
      if (A[a] < B[b]) {
        a++;
      } else {
        b++;
      }
    }
    return [index1, index2];
  }
/**
 * Core Method for Insert that supports all the insert commands found in commands.json
 * @param inputText -The input text segment.
 * @param pattern - The JSON object constructed.
 * @param isMultimodal - Boolean value.
 */
  async coreInsert(inputText, pattern, isMultimodal) {
    let result = '';
    let retParams = {
      Entity: '', InputText: inputText, Result: result,
      Indices: [0]
    };
    const x = pattern.X;
    let y = pattern.Y;
    const z = pattern.Z;
    const p = pattern.Preposition;
    const yCount = pattern.CountY;
    let entity = x;
    if (this.insertEndFlag === true) {
      this.insertEndFlag = false;
      let position = inputText.length + 1;
      const indexes = [position];
      const entityArray = SpanService.tokenizeString(entity).filter(word => word !== ' ');
      for (let i = 0; i < entityArray.length - 1; i++) {
        indexes.push(position + entityArray[i].length + 1);
        position = position + entityArray[i].length + 1;
      }
      const residueResult = ' ' + '<mark>' + entity + '</mark>';
      result = inputText.concat(residueResult);
      retParams = {
        Entity: x, InputText: inputText, Result: result,
        Indices: indexes
      };
      return retParams;
    }
    if (p.length > 0) {
      if (yCount === -1 && p === 'p3') {
        console.log('x: ' + x);
        result = inputText.substring(0, inputText.length - 2) + ' ' + '<mark>' + entity + '</mark>' + inputText.substring(inputText.length - 2);
        retParams = {
          Entity: entity, InputText: inputText, Result: result,
          Indices: [inputText.length - 1, inputText.length]
        };
      } else if (p === 'p2') {
        if (y === '') { // Multimodal if Y unavailable
          const cursor = await SpanService.getCursorPosDiv('mainDiv');
          console.log('cursor1', cursor);
          if (cursor.begin === -1 || cursor.end === -1) {
            // use other cursor function
            cursor.begin = SpanService.cursorSelection.startChar;
            cursor.end = SpanService.cursorSelection.endChar;
            console.log('cursorIn', cursor);
          }
          const currText = document.getElementById('mainDiv').innerText;
          y = await this.getWordAtPCursorPosition(currText, cursor.end);
        }
        const indices = await this.getIndicesOf(y, inputText, false);
        let indexP2;
        if (yCount > 0) {
          indexP2 = indices[yCount - 1];
        } else {
          indexP2 = indices[0];
        }
        if (indexP2 > 0) {
          result = inputText.substring(0, indexP2 + y.length) + ' ' + '<mark>' + entity + '</mark>'
            + ' ' + inputText.substring(indexP2 + y.length, inputText.length);
        } else {
          result = inputText;
        }
        const entityTokens = SpanService.tokenizeString(entity).filter(word => word !== ' ');
        const indexes = [indexP2];
        for (let i = 0; i < entityTokens.length - 1; i++) {
          indexes.push(indexP2 + entityTokens[i].length + 1);
          indexP2 = indexP2 + entityTokens[i].length + 1;
        }
        // call logs
        retParams = {
          Entity: entity, InputText: inputText, Result: result,
          Indices: indexes
        };
      } else if (p === 'p1') {
        if (y === '') { // Multimodal if Y unavailable
          const cursor = await SpanService.getCursorPosDiv('mainDiv');
          console.log('cursor2', cursor);
          if (cursor.begin === -1 || cursor.end === -1) {
            // use other cursor function
            cursor.begin = SpanService.cursorSelection.startChar;
            cursor.end = SpanService.cursorSelection.endChar;
            console.log('cursorIn', cursor);
          }
          const currText = document.getElementById('mainDiv').innerText;
          y = await this.getWordAtPCursorPosition(currText, cursor.start);
        }
        const re = new RegExp('(?:^|\\s)' + y + '(,|;|&|%|\\s?)', 'i');
        let indexP1;
        if (yCount > 0) {
          const indices = await this.getIndicesOf(y, inputText, false);
          indexP1 = indices[yCount - 1];
        } else {
          indexP1 = inputText.search(re);
        }
        if (indexP1 >= 0) {
          entity = this.updateCapitalization(entity, indexP1);
          result = inputText.substring(0, indexP1) + ' ' + '<mark>' + entity + '</mark>' + ' ' + inputText.substring(indexP1);
          console.log(result);
        }
        // call logs
        retParams = {
          Entity: entity, InputText: inputText, Result: result,
          Indices: [indexP1, indexP1]
        };

      } else if (y.length > 0 && z.length > 0) {
        console.log('Y and Z are', y, z);
        const re1 = new RegExp('(?:^|\\s?)' + y + '\\s' + z, 'i');
        const index = inputText.search(re1);
        if (index !== -1) {
        result = inputText.substring(0, index + y.length + 1) + ' ' + '<mark>' + entity + '</mark>'  + ' ' + inputText.substring(index + y.length + 1, inputText.length);
        } else {
          result = inputText;
        }
        // call logs
        retParams = {
          Entity: entity, InputText: inputText, Result: result,
          Indices: [index]
        };
      }
    } else { // Needs to be looked into.
      // insert x [multimodal]
      const cursor = await SpanService.getCursorPosDiv('mainDiv').begin;
      console.log('cursor3', cursor);
      if (cursor.begin === -1 || cursor.end === -1) {
        // use other cursor function
        cursor.begin = SpanService.cursorSelection.startChar;
        cursor.end = SpanService.cursorSelection.endChar;
        console.log('cursorIn', cursor);
      }
      isMultimodal = true;
      const index = cursor.begin ? cursor.begin : cursor;
      console.log('cursor31', index);
      inputText = document.getElementById('mainDiv').innerText; // taking the current state of the sentence
      if (index >= 0) {
        result = inputText.substring(0, index) + ' ' + '<mark>' + entity + '</mark>' + ' ' + inputText.substring(index, inputText.length);
      } else {
        result = inputText;
      }
      retParams = {
        Entity: entity, InputText: inputText, Result: result,
        Indices: [index, index]
      };
    }
    retParams.Result = retParams.Result.replace(/\s+/g, ' ').trim();
    console.log(retParams.Result);
    return retParams;
  }

/**
 * This is the core method for replace that handles all the replace commands in commands.json
 * @param inputText - The input text segment.
 * @param pattern - The JSON object constructed.
 */
  coreReplace(inputText, pattern) {
    let result = '';
    let retParams = {
      Entity: '', InputText: inputText, Result: result,
      Indices: [0]
    };
    let x = pattern.X;
    const countX = pattern.CountX;
    const y = pattern.Y;
    const z = pattern.Z;
    const a = pattern.A;
    const p = pattern.Preposition;
    const yCount = pattern.CountY;
    const entity = new RegExp('(?:^|\\s)' + x + '(?:^|\\s)', 'i');
    if (p.length > 0) {
      if (p === 'p4') {
        const re = new RegExp('(?:^|\\s)' + y + '(?:^|\\s?)' + x + '(?:^|\\s)' + z, 'i');
        const index = inputText.search(re);
        if (index !== -1) {
          const beforeString = inputText.substring(0, index + y.length + 1);
          result = beforeString + ' ' + '<mark>' + a + '</mark>' + inputText.substring(index + y.length + x.length + 2, inputText.length);
        }
        else{
          document.getElementById('warning').innerHTML = x + ', ' + y + ' or '+ z + ' does not exist!';
        }
      }
      if (p === 'p1') { // condition for before
        if (countX === 0) {
          let re;
          if (y.length > 0) {
            if (/[.,:!?]/.test(y)) {
              re = new RegExp('(?:^|\\s)' + x + y, 'i');
            } else {
              re = new RegExp('(?:^|\\s?)' + x + '(?:^|\\s)' + y, 'i');
            }
          }

          let indexP1;
          if (yCount > 0) {
            const indices = this.getIndicesOf(y, inputText, false);
            indexP1 = indices[yCount - 1];
            const indexP2 = inputText.search(re);
            if (indexP2 + x.length + 2 === indexP1) {
              indexP1 = indexP2;
            }
          } else {
            indexP1 = inputText.search(re);
          }
          const beforeString = inputText.substring(0, indexP1).trim();
          if (indexP1 !== -1) {
            if (/[.,:!?]/.test(y)) {
              result = beforeString + ' ' + '<mark>' +  z + '</mark>' + inputText.substring(indexP1 + x.length + 1, inputText.length);
            } else {
              result = beforeString + ' ' + '<mark>' +  z + '</mark>' + ' ' + inputText.substring(indexP1 + x.length + 2, inputText.length);
            }
          } else {
            result = inputText;
            document.getElementById('warning').innerHTML = x + ' before ' + y + ' does not exist!';
          }
          retParams.Entity = x;
          retParams.InputText = inputText;
          retParams.Result = result;
          retParams.Indices = [indexP1];
        }
      } else if (x.includes(this.words)) {
          x = x.replace(this.words, '');
          const numberOfWords = x[x.length - 1];
          x = x.replace(numberOfWords, '');
          const entityArray = SpanService.tokenizeString(x).filter(word => word !== ' ');
          const inputArray = SpanService.tokenizeString(inputText).filter(word => word !== ' ');
          const entityPosition = inputArray.indexOf(entityArray[0]);
            // tslint:disable-next-line:radix
          const input = inputArray.splice(entityPosition, parseInt(numberOfWords));
          const reg = new RegExp(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g);
          x = '';
          for (let z = 0; z < input.length; z++) {
            if (input[z].search(reg) !== -1) {
              x += input[z];
            } else {
              x += ' ' + input[z];
            }
          }
          let finalResult = '';
          for (let i = 0; i < inputArray.length; i++) {
            if (i === entityPosition) {
              finalResult += ' ' + '<mark>' +  y + '</mark>';
            }
            if (inputArray[i].search(reg) !== -1) {
              finalResult += inputArray[i];
            } else {
              finalResult += ' ' + inputArray[i];
            }
          }
          retParams.Entity = x;
          retParams.InputText = inputText;
          retParams.Result = finalResult;
          retParams.Indices = [entityPosition];
          return retParams;
      } else if (this.sentenceArray.indexOf(x.toLowerCase()) > -1) {
        retParams.Entity = inputText;
        retParams.InputText = inputText;
        retParams.Result = y;
        let inputTextArray = SpanService.tokenizeString(inputText).filter(word => word !== ' ');
        for (let i = 1 ; i < inputTextArray.length; i++){
          retParams.Indices.push(i);
       }
        return retParams;
      } else if (p === 'p3') {
        const re = new RegExp('(?:^|\\s)' + x, 'gi');
        const index = inputText.search(re);
        if (index !== -1) {
          const beforeString = inputText.substring(0, index).trim();
          result = beforeString + ' ' + '<mark>' +  y + '</mark>' + inputText.substring(index + x.length + 1, inputText.length);
        } else {
        const re = new RegExp('(?:^|\\s?)' + x, 'gi');
        const index = inputText.search(re);
        if (index !== -1) {
          const beforeString = inputText.substring(0, index).trim();
          if (x === '.' || x === ',' || x === ':' || x === '!' || x === '?') {
            result = beforeString + '<mark>' +  y + '</mark>' + ' ' + inputText.substring(index + x.length + 1, inputText.length);
          }
        } else {
          result = inputText;
          document.getElementById('warning').innerHTML = x + ' does not exist!';
        }
      }
        retParams.Entity = x;
        retParams.InputText = inputText;
        retParams.Result = result;
        retParams.Indices = [index];
      } else if (p === 'p2') { // condition for after
        if (countX === 0) {// Eg: korrigiere , nach Hallo durch dein.
          const re = new RegExp('(?:^|\\s)' + y + '(\\s?)' + x + '(?:^|\\s)', 'i');
          const indices = this.getIndicesOf(y, inputText, false);
          let index;
          if (yCount > 0) {
            index = indices[yCount - 1];
          } else {
            index = inputText.search(re);
          }
          let afterString;
          if (index !== -1) {
            if (/[.,:!?]/.test(x)) {
              afterString = inputText.substring(index + y.length + 1, inputText.length).replace(x, '');
              if (z.length > 1) {
                result = inputText.substring(0, index + y.length + 1) + ' ' + '<mark>' + z + '</mark>' + afterString;
              } else {
              result = inputText.substring(0, index + y.length + 1) + '<mark>' + z + '</mark>' + afterString;
              }
            } else {
              afterString = inputText.substring(index + y.length + 1, inputText.length).replace(entity, '');
              result = inputText.substring(0, index + y.length + 1) + ' ' + '<mark>' + z + '</mark>' + ' ' + afterString;
            }
          } else {
            document.getElementById('warning').innerHTML = x + ' after ' + y + ' does not exist!';
            result = inputText;
          }
          retParams = {
            Entity: x, InputText: inputText, Result: result,
            Indices: [index]
          };
        } else if (countX > 0 || countX === -1) {
          const indices = this.getIndicesOf(x, inputText, false);
          let index;
          if (countX > 0) {
            index = indices[countX - 1]; } else {
            index = indices[indices.length - 1];
          }
          if (index !== -1 && index !== undefined) {
            // tslint:disable-next-line:max-line-length
            result = inputText.substring(0, index) + '<mark>' +  y + '</mark>' + ' ' + inputText.substring(index + x.length + 1, inputText.length);
          } else {
            document.getElementById('warning').innerHTML = x + ' does not exist!';
            result = inputText;
          }
          retParams = {
            Entity: x, InputText: inputText, Result: result,
            Indices: [index]
          };
        }
      }
    }
    retParams.Result = result;
    return retParams;
  }
  /**
   * Wrapper function that calls insert method to insert the word(s) in the speech input into the segment.
   * @param inputText - The current input segment.
   * @param pattern - The JSON object constructed.
   * @param isMultimodal - Boolean value
   */
  async insertWrapper(inputText, pattern, isMultimodal) {
    let result;
    const getReturn = await this.coreInsert(inputText, pattern, isMultimodal);
    console.log('The result in insert_json is', getReturn);
    if (getReturn.Result !== '') {
      const entity = getReturn.Entity;
      result = getReturn.Result;
      const indices = getReturn.Indices;
      result = result.replace(/\s+/g, ' ').trim();
      if (getReturn.Result !== inputText && indices[0] !== -1) {
        this.callLog('Insert', entity, '', inputText, result.replace('<mark>', '').replace('</mark>', ''), indices, isMultimodal);
      } else {
        const mainArray = SpanService.tokenizeString(inputText).filter(word => word !== ' ');
        if (pattern.Z !== '') {
          if (!inputText.includes(pattern.Y)) {
               if (mainArray[mainArray.indexOf(pattern.Y) + 1] !== pattern.Z) {
                document.getElementById('warning').innerHTML = pattern.Y + ' and ' + pattern.Z + ' does not exist!';
               } else {
                document.getElementById('warning').innerHTML = pattern.Y + ' does not exist!';
               }
            } else {
                document.getElementById('warning').innerHTML = pattern.Z + ' does not exist!';
            }
        } else {
        document.getElementById('warning').innerHTML = pattern.Y + ' does not exist!';
        }
      }
    } else {
      const mainArray = SpanService.tokenizeString(inputText).filter(word => word !== ' ');
      if (pattern.Z !== '') {
        if (!inputText.includes(pattern.Y)) {
             if (mainArray[mainArray.indexOf(pattern.Y) + 1] !== pattern.Z) {
              document.getElementById('warning').innerHTML = pattern.Y + ' and ' + pattern.Z + ' does not exist!';
             } else {
              document.getElementById('warning').innerHTML = pattern.Y + ' does not exist!';
             }
          } else {
              document.getElementById('warning').innerHTML = pattern.Z + ' does not exist!';
          }
      } else {
      document.getElementById('warning').innerHTML = pattern.Y + ' does not exist!';
      }
      result = inputText;
    }
    return result;
  }

  /**
   * Wrapper method that calls delete method followed by insert method, thereby moving the word(s) in the speech input to a new index in the segment.
   * @param inputText - The current input segment.
   * @param pattern - The JSON object constructed.
   * @param isMultimodal - Boolean value
   */
  async moveWrapper(inputText, pattern, isMultimodal) {
    let result = '';
    document.getElementById('warning').innerHTML = '';
    let x = pattern.X;
    let count = pattern.CountX;
    let y = pattern.Y;
    const z = pattern.Z;
    const p = pattern.Preposition;
    let ycount = pattern.CountY;
    let flag = false;
    const xCursor = pattern.cursorX;
    if (x.toLowerCase() === this.WORD && count > 0) {
      const findArray = SpanService.tokenizeString(inputText).filter(word => word !== ' ');
      x = findArray[count - 1];
      console.log('x is', x);
      count = 0;
    }
    const puncRegexRep = /([.,!":])/g;
    inputText = inputText.split(puncRegexRep).join(' ');
    let retCore;
    if (ycount > 0) {
      if (y.toLowerCase() === this.WORD) {
        const findArray = SpanService.tokenizeString(inputText).filter(word => word !== ' ');
        y = findArray[ycount - 1];
        retCore = await this.deleteEntityAtPosition(x, inputText, count, xCursor);
        result = retCore.Result;
        ycount = 0;
      } else {
      const indices = this.getIndicesOf(y, inputText, true);
      if (indices[ycount - 1]) {
        retCore = await this.deleteEntityAtPosition(x, inputText, count, xCursor);
        result = retCore.Result;
      }
    }
    } else {
      let re;
      if (z !== '') {
        if (/[.,:!;&?]/.test(y)) {
          re = new RegExp('(?:^|\\s?)' + y + '(\\s)' + z, 'i');
        } else {
          re = new RegExp('(?:^|\\s)' + y + '(\\s?)' + z, 'i');
        }
      } else {
        if (/[.,:!;&?]/.test(y)) {
          re = new RegExp('(?:^|\\s?)' + y, 'i');
        } else {
          re = new RegExp('(?:^|\\s)' + y, 'i');
        }
      }
      const index = inputText.search(re);
      if (ycount === 0 && index !== -1) {
        retCore = await this.deleteEntityAtPosition(x, inputText, count, xCursor);
        result = retCore.Result;
      } else if (index === -1) {
        flag = true;
        document.getElementById('warning').innerText = y + ' does not exist';
      }
    }
    if (result !== '' && result !== inputText) {
      const oldPosition = retCore.Indices;
      inputText = result;
      console.log('move: ' + result);
      if (y.toLowerCase() === this.WORD) {
        const detectArray = SpanService.tokenizeString(inputText).filter(word => word !== ' ');
        y = detectArray[ycount - 1];
        ycount = 0;
      }
      if (x.includes(this.words)) {
        x = '';
        const reg = new RegExp(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g);
        for (let j = 0; j < this.deleteWords.length; j++) {
          if (this.deleteWords[j].search(reg) !== -1) {
            x += this.deleteWords[j];
          } else {
            x += ' ' + this.deleteWords[j];
          }
        }
      }
      console.log(['insert', x, count, y, z, p, ycount]);
      result = result.split(puncRegexRep).join(' ');
      const patternObject = { operation: 'insert', Preposition: p, X: x, Y: y, CountY: ycount, Z: z, CountX: count };
      const getInsert = await this.coreInsert(result, patternObject, isMultimodal);
      result = getInsert.Result;
      if (result !== '' && result != inputText) {
        const newPosition = getInsert.Indices[0];
        result = result.replace(/\s+/g, ' ').trim();
        this.callLog('Move', x, '', inputText, result.replace('<mark>', '').replace('</mark>', '').replace('<em>', '').replace('</em>', ''), [oldPosition, newPosition], isMultimodal);
      } else {
        result = inputText;
      }
    } else if (flag === false) {
      document.getElementById('warning').innerHTML = pattern.X + ' does not exist!';
      result = inputText;
      } else {
        result = inputText;
      }
    return result;
  }


   /**
   *  Wrapper method that calls replace method to replace parts of the segment according to the speech input.
   * @param inputText - The current input segment.
   * @param pattern - The JSON object constructed.
   * @param isMultimodal - Boolean value
   */
  async replaceWrapper(inputText, pattern, isMultimodal) {
    let result;
    const y = pattern.Y;
    const z = pattern.Z;
    const getReturn = await this.coreReplace(inputText, pattern);
    if (getReturn.Result !== '') {
      const entity = getReturn.Entity;
      result = getReturn.Result;
      const indices = getReturn.Indices;
      if (getReturn.Result !== inputText) {
        if (z.length > 0) {
          // tslint:disable-next-line:max-line-length
          this.callLog('Replace', entity, z, inputText, result.replace('<mark>', '').replace('</mark>', '').replace('<em>', '').replace('</em>', ''), indices, isMultimodal);
        } else {
          // tslint:disable-next-line:max-line-length
          this.callLog('Replace', entity, y, inputText, result.replace('<mark>', '').replace('</mark>', '').replace('<em>', '').replace('</em>', ''), indices, isMultimodal);
        }
      } else {
        result = inputText;
      }
    }
    return result;
  }

  /**
   * This function returns multi modal interaction type
   * @param isMultimodal - if false return speech else other interaction modalities
   *
   */
  getInteractionModality(isMultimodal): InteractionModality {
    if (!isMultimodal) {
      return InteractionModality.SPEECH;
    } else {
      if (this.interactionType) {
        switch (this.interactionType) {
          case InteractionModality.PEN:
            return InteractionModality.SPEECH_PEN;
          case InteractionModality.MOUSE:
            return InteractionModality.SPEECH_MOUSE;
          case InteractionModality.FINGER:
            return InteractionModality.SPEECH_FINGER;
          case InteractionModality.KEYBOARD:
            return InteractionModality.SPEECH_KEYBOARD;
        }
      }
      console.error('this case should no happen!!');
      return InteractionModality.SPEECH;
    }
  }

  /**
   * Calls the highlevel text log
   * @param operation : Operation under consideration
   * @param entity :entity in the command
   * @param target : entity is replaced by the target in the inputText
   * @param inputText : Initial segment content before the command is executed
   * @param result : Final segment after the command execution
   * @param indices : Indices of the inputText array that has been modified
   * @param isMultimodal : Boolean which determines whether the command is multimodal or not
   */
  callLog(operation, entity, target, inputText, result, indices, isMultimodal) {
    const index = indices[0];
    console.log('Is multimodal', isMultimodal);
    const interactionModality = this.getInteractionModality(isMultimodal);
    console.log('InteractionModality: ', isMultimodal, interactionModality);
    if (entity.indexOf(' ') > 0) {
      const logPosition = [index];
      for (let i = 1; i < indices.length; i++) {
        logPosition.push(indices[i]);
      } // call function
      if (operation === 'Delete') {
        this.logService.logDeleteGroup(interactionModality,
          InteractionSource.MICROPHONE, inputText, result, logPosition, entity.split());
      }
      if (operation === 'Insert') {
        this.logService.logInsertGroup(interactionModality,
          InteractionSource.MICROPHONE, inputText, result, logPosition, entity.split());
      }
      if (operation === 'Replace') {
        this.logService.logReplaceGroup(interactionModality,
          InteractionSource.MICROPHONE, inputText, result, logPosition, entity.split(), target);
      }
      if (operation === 'Restate') {
        this.logService.logRestateGroup(interactionModality,
          InteractionSource.MICROPHONE, inputText, result, logPosition, entity.split(), target);
      }
      if (operation === 'Move') {
        this.logService.logReorderGroup(interactionModality,
          InteractionSource.MICROPHONE, inputText, result, entity.split(), indices[0], indices[1]);
      }
    } else {
      if (operation === 'Delete') {
        this.logService.logDeleteSingle(interactionModality, InteractionSource.MICROPHONE, inputText,
          result, 'char:' + index, entity);
      }
      if (operation === 'Insert') {
        this.logService.logInsertSingle(interactionModality, InteractionSource.MICROPHONE, inputText,
          result, 'char:' + index, entity);
      }
      if (operation === 'Replace') {
        this.logService.logReplaceSingle(interactionModality, InteractionSource.MICROPHONE, inputText,
          result, 'char:' + index, entity, target);
      }
      if (operation === 'Restate') {
        this.logService.logRestateSingle(interactionModality, InteractionSource.MICROPHONE, inputText,
          result, 'char:' + index, entity, target);
      }
      if (operation === 'Move') {
        this.logService.logReorderSingle(interactionModality, InteractionSource.MICROPHONE, inputText,
          result, entity, indices[0], indices[1]);
      }
    }
  }

  /**
   * Deletes the entity at the position of occurrence within inputText.
   * @param entity - the substring to delete
   * @param inputText - the overall string from which to delete
   * @param pos - 0, if the first occurrence should be deleted (delete X), > 0 if specified that the second, third, etc.
   * occurrence should be deleted
   * deletePosition = multimodal char position
   */
  async deleteEntityAtPosition(entity, inputText, pos, deletePosition) {
    console.log('deleteEntityAtPosition called', entity, pos, inputText);
    let result = '';
    inputText = inputText.replace(/\s+/g, ' ').trim();
    inputText = inputText.replace(/ \,/g, ',');
    let indices = await this.getIndicesOf(entity.toLowerCase(), inputText.toLowerCase(), false);
    let index;
    if (pos > 0 && pos < 10000 || (pos === 0 && this.deleteEndFlag === true)) {
      // tslint:disable-next-line:max-line-length
      if (entity.toLowerCase() === this.WORD) { // Delete third word. Uses command DELETE count x. x being the entity. Here x is just word placeolder. The actual word to be deleted is in the text segment.
        const resultArray = SpanService.tokenizeString(inputText).filter(word => word !== ' ');
        const re = new RegExp(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g);
        entity = resultArray.splice(pos - 1, 1);
        entity = entity.toString();
        indices = await this.getIndicesOf(entity.toLowerCase(), inputText.toLowerCase(), false);
        for (let i = 0; i < resultArray.length; i++) {
          if (i === pos - 1) {
            result += '<em>' + ' ' + '</em>';
          }
          if (resultArray[i].search(re) !== -1) {
            result += resultArray[i];
          } else {
            result += ' ' + resultArray[i];
          }
        }
        console.log(result, resultArray);
      } else if (this.deleteEndFlag === true) {
        let inputArray = SpanService.tokenizeString(inputText).filter(word => word !== ' ');
        inputArray = inputArray.reverse();
        const reg = new RegExp(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g);
        let resultText = '';
        for (let i = 0; i < inputArray.length; i++) {

          if (inputArray[i].search(reg) !== -1) {
            resultText += inputArray[i];
          } else {
            resultText += ' ' + inputArray[i];
          }
        }
        this.deleteEndFlag = false;
        let re;
        if (!/[.,:!;&?]/.test(entity)) {
        re = new RegExp('(?:^|\\s)' + entity.toLowerCase() + '(,|\\s)', 'i');
      } else {
        re = new RegExp(entity.toLowerCase(), 'i');
      }
        index = resultText.toLowerCase().search(re);
        if (index !== -1) {
        index = inputText.length - (index + entity.length - 1) - 1;
        const beforeString = inputText.substring(0, index);
        if (index !== -1) {
          if (/[.,:!;&?]/.test(entity)) {
            result = beforeString + '<em>' +  ' ' + '</em>' + inputText.substring(index + entity.length, inputText.length);
            // tslint:disable-next-line:max-line-length
          } else if (inputText.charAt(index + entity.length) === ',' || inputText.charAt(index + entity.length + 1) === '.' || inputText.charAt(index + entity.length + 1) === '%' || inputText.charAt(index + entity.length + 1) === '!' || inputText.charAt(index + entity.length + 1) === ':') {
            result = beforeString + '<em>' + ' ' + '</em>' + inputText.substring(index + entity.length, inputText.length);
          } else {
            result = beforeString + '<em>' + ' ' + '</em>' + inputText.substring(index + entity.length + 1, inputText.length);
          }
        }
      }
      } else if (entity === this.END_PLACEHOLDER) { // In case of deleting words from the end.
        let inputArray = SpanService.tokenizeString(inputText).filter(word => word !== ' ');
        inputArray = inputArray.reverse();
        entity = inputArray.splice(pos - 1, 1);
        entity = entity.toString();
        indices = await this.getIndicesOf(entity.toLowerCase(), inputText.toLowerCase(), false);
        inputArray = inputArray.reverse();
        const re = new RegExp(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g);
        for (let i = 0; i < inputArray.length; i++) {
          console.log('Pos and I', i, inputArray.length - pos - 1);
          if (i === inputArray.length - pos + 1) {
            result += '<em>' + ' ' + '</em>';
          }
          if (inputArray[i].search(re) !== -1) {
            result += inputArray[i];
          } else {
            result += ' ' + inputArray[i];
          }
        }
      } else if (indices.length < pos) { // Ex: Delete third Kunden, but the text segment has only one Kunden
        result = inputText;
        document.getElementById('warning').innerHTML = entity + ' at position ' + pos + ' does not exist!';
      } else {
        result = inputText.substring(0, indices[pos - 1]) + '<em>' + ' ' + '</em>' + inputText.substring(indices[pos - 1] + entity.length);
      }
    } else if (entity.includes(this.words)) {
    entity = entity.replace(this.words, '');
    const numberOfWords = entity[entity.length - 1];
    entity = entity.replace(numberOfWords, '');
    const entityArray = SpanService.tokenizeString(entity).filter(word => word !== ' ');
    const inputArray = SpanService.tokenizeString(inputText).filter(word => word !== ' ');
    const entityPosition = inputArray.indexOf(entityArray[0]);
      // tslint:disable-next-line:radix
    this.deleteWords = inputArray.splice(entityPosition, parseInt(numberOfWords));
    const reg = new RegExp(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g);
    let result = '';
    for (let i = 0; i < inputArray.length; i++) {
      if (i === entityPosition) {
        result += '<em>' + ' ' + '</em>';
      }
      if (inputArray[i].search(reg) !== -1) {
        result += inputArray[i];
      } else {
        result += ' ' + inputArray[i];
      }
    }
    console.log('Entity', entity, result);
    return {
      Entity: entity, InputText: inputText, Result: result,
      Indices: entityPosition
    };
    } else if (pos === -1) {
      index = inputText.toLowerCase().lastIndexOf(entity.toLowerCase());
      if (index === -1) {
        index = inputText.toLowerCase().lastIndexOf(entity.toLowerCase());
      }
      result = inputText.substring(0, index) + inputText.substring(index + entity.length);
    } else if (pos === 10000) {
      result = '';
    } else if (pos === 0) {
      let re;
      if (!/[.,:!;&?]/.test(entity)) {
        re = new RegExp('(?:^|\\s)' + entity.toLowerCase(), 'i');
      } else {
        re = new RegExp(entity.toLowerCase(), 'i');
      }
      index = inputText.toLowerCase().search(re);
      const beforeString = inputText.substring(0, index);
      if (index !== -1) {
        if (/[.,:!;&?]/.test(entity)) {
          result = beforeString + '<em>' + ' ' + '</em>' + inputText.substring(index + entity.length, inputText.length);
          // tslint:disable-next-line:max-line-length
        } else if (inputText.charAt(index + entity.length) === ',' || inputText.charAt(index + entity.length + 1) === '.' || inputText.charAt(index + entity.length + 1) === '%' || inputText.charAt(index + entity.length + 1) === '!' || inputText.charAt(index + entity.length + 1) === ':') {
          result = beforeString + '<em>' + ' ' + '</em>' + inputText.substring(index + entity.length + 1, inputText.length);
        } else {
          result = beforeString + '<em>' + ' ' + '</em>' + inputText.substring(index + entity.length + 1, inputText.length);
        }
      } else {
        document.getElementById('warning').innerHTML = entity + ' does not exist!';
      }
    }
    let retIndices;
    if (indices.length > 0) {
      retIndices = indices;
    } else {
      retIndices = [index];
    }
    console.log('delete single: ' + result);
    const retParams = {
      Entity: entity, InputText: inputText, Result: result,
      Indices: retIndices
    };
    return {
      Entity: entity, InputText: inputText, Result: result,
      Indices: retIndices
    };
  }

/**
 * Returns all the indices of a searchstr (word) within the segment.
 * @param searchStr - The search string that needs to be found within the segment.
 * @param str - The main string in which the searchstr needs to be found.
 * @param caseSensitive - Boolean value indicating the type of match to be performed.
 **/
  getIndicesOf(searchStr, str, caseSensitive) {
    const searchStrLen = searchStr.length;
    if (searchStrLen === 0) {
      return [];
    }
    let startIndex = 0;
    let index;
    const indices = [];
    if (!caseSensitive) {
      str = str.toLowerCase();
      searchStr = searchStr.toLowerCase();
    }
    // If searchStr is a punctuation
    if (searchStr.length === 1) {
      index = str.indexOf(searchStr, startIndex);
      while (index > -1) {
        indices.push(index);
        startIndex = index + searchStrLen;
        index = str.indexOf(searchStr, startIndex);
      }
    } else {
      const re = new RegExp('(?:^|\\s)' + searchStr, 'g');
      index = str.search(re);
      while (index > -1) {
        indices.push(index + 1);
        // tslint:disable-next-line:max-line-length
        str = str.substring(0, index + 1) + [...searchStr].reverse().join('') + ' ' + str.substring(index + searchStr.length + 2, str.length);
        index = str.search(re);
      }
    }
    return indices;
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
