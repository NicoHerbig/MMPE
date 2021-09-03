import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import * as $ from 'jquery';

const spellcheckAPI = Object.create(null);
spellcheckAPI.OWN = getBaseLocation();
spellcheckAPI.MS_AZURE = 'api.cognitive.microsoft.com/bing/v7.0/spellcheck';

@Injectable({
  providedIn: 'root'
})
export class SpellcheckService {

  private API;
  private sentenceStart;

  constructor(private httpClient: HttpClient) {
    // take own API as default
    this.API = spellcheckAPI.OWN;
    this.sentenceStart = [];
  }

  // removes the 'misspelled' class from all spans in the given div
  static unmark(divID): void {
    for (const span of $(divID).find('span')) {
      $(span).removeClass('misspelled');
    }
  }

  // adds the 'misspelled class to those spans in the given div that have a textContent from the given words
  static mark(divID, words): void {

    for (const span of $(divID).find('span')) {
      if (words.includes(span.textContent)) {
        $(span).addClass('misspelled');
      }
    }
  }


  public setAPI(API): void {
    this.API = API;
  }

  public checkSpelling(wordSequence: string, languageCode: string = 'de-DE', editDist?: number, numSuggestions?: number): Observable<any> {

    // preprocess words
    const words = this.preprocessWordSequence(wordSequence);

    // generate request data
    const requestBody = this.generateRequestData(words, languageCode, editDist, numSuggestions);

    // send request
    return this.sendRequest(requestBody).pipe(
      map(event => {

        const sentenceInformation = this.sentenceStart.shift();

        const misspelledWords = [];
        const misspellings = event['misspellings'];

        // check sentence start
        if (sentenceInformation !== undefined) {
          for (const index of sentenceInformation) {

            if (words[index].charAt(0) !== words[index].charAt(0).toUpperCase() && !misspellings.includes(index)) {
              misspellings.push(index);
            }
          }
        }

        // reported misspellings
        for (const misspellingIndex of misspellings) {

          const originalSentence = words.slice(0, words.length - sentenceInformation.length);

          // original sentence
          if (misspellingIndex < originalSentence.length) {

            // check if the misspelled word is the beginning of a sentence
            if (sentenceInformation.includes(misspellingIndex)) {
              // check if it is reported to be misspelled because a non noun had a capital letter
              // capitalized
              if (words[misspellingIndex].charAt(0) === words[misspellingIndex].charAt(0).toUpperCase()) {
                const uc = words[misspellingIndex].charAt(0).toLowerCase() + words[misspellingIndex].substring(1);
                // not capitalized spelled correctly
                if (!misspellings.includes(words.indexOf(uc))) {
                  continue;
                }
              }

            }

            misspelledWords.push(words[misspellingIndex]);
          }
        }
        return misspelledWords;
      })
    );
  }

  private preprocessWordSequence(wordSequence: string): string[] {

    const removeCharacters = [',', ';', ':', '"'];
    const punctuationMarks = ['.', '!', '?'];
    const sequenceSentenceStart = [];

    // transform new lines to spaces
    wordSequence = wordSequence.replace(/\n/g, ' ');

    // remove characters to ignore
    for (const char of removeCharacters) {
      wordSequence = wordSequence.split(char).join('');
    }

    // separate words (split at whitespaces)
    let words = wordSequence.split(' ');
    const numWords = words.length;

    // remove punctuation marks ('.', '!', '?') at end of word and add the next
    // word with and without first letter capital
    for (let i = 0; i < numWords; i++) {

      // first word should always be start of a sentence
      if (i === 0) {
        sequenceSentenceStart.push(i);
        words.push(words[i].charAt(0).toLowerCase() + words[i].substr(1));
      }

      // word ends with punctuation --> end of sentence, next word will be the start of a new one
      if (punctuationMarks.includes(words[i].charAt(words[i].length - 1))) {

        // remove punctuation mark from end of current word
        words[i] = words[i].substring(0, words[i].length - 1);

        // not last word in sequence --> add next to sentence starts
        if (i < numWords - 1) {
          sequenceSentenceStart.push(i + 1);

          // next word also start of sentence? --> remove punctuation for spellcheck
          if (punctuationMarks.includes(words[i + 1].charAt(words[i + 1].length - 1))) {
            words.push(words[i + 1].charAt(0).toLowerCase() + words[i + 1].substring(1, words[i + 1].length - 1));
          } else {
            words.push(words[i + 1].charAt(0).toLowerCase() + words[i + 1].substring(1));
          }
        }
      }
    }

    words = words.filter(word => word !== '');

    this.sentenceStart.push(sequenceSentenceStart);
    return words;
  }

  private generateRequestData(words: string[], languageCode: string, editDist?: number, numSuggestions?: number) {

    let requestData = {};

    switch (this.API) {

      case spellcheckAPI.OWN: {
        requestData = { words, languageCode };
        if (editDist) { const key = 'editDist'; requestData[key] = editDist; }
        if (numSuggestions) { const key = 'numSuggestions'; requestData[key] = numSuggestions; }
        return requestData;
      }

      case spellcheckAPI.MS_AZURE:
        // create and return request according to the MS spellcheck documentation
        // https://docs.microsoft.com/en-us/azure/cognitive-services/bing-spell-check/quickstarts/nodejs
        requestData = null;
        return requestData;

      default:
        requestData = null;
        return requestData;
    }
  }

  private sendRequest(body, options?): Observable<any> {

    if (options === undefined) {
      return this.httpClient.post(this.API, body);
    } else {
      return this.httpClient.post(this.API, body, options);
    }
  }
}

function getBaseLocation() {
  let url = window.location.href;
  let arr = url.split("/");
  let path = ":3000";
  let result = arr[0] + "//" + arr[2].split(":")[0];
  result = result + path + "/spelling"; 
  return result;  
}
