import {Component} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {LogService} from '../../services/log/log.service';
import {InteractionModality} from '../../model/InteractionModality';
import * as $ from 'jquery';

@Component({
  selector: 'app-dictionary',
  templateUrl: './dictionary.component.html',
  styleUrls: ['./dictionary.component.scss']
})
export class DictionaryComponent {

  private typingTimeout = null;
  public baseUrl = 'http://localhost:3000/dictionary';

  public supportedLanguages = ['ENG', 'GER', 'FRA', 'SPA', 'CHI', 'RUS', 'JPN', 'POR', 'ITA', 'DUT', 'POL'];
  public from = 'ENG';
  public to = 'GER';

  public response = undefined;
  public error = false;
  public searchTerm = '';

  private termManuallyEntered;

  constructor(private httpClient: HttpClient,
              private log: LogService) { }

  onSearchTermEnter(event): void {

    // Clear the timeout if it has already been set. This will prevent the previous task from executing
    // if it has been less than <MILLISECONDS>
    clearTimeout(this.typingTimeout);

    // Make a new timeout set to go off in <MILLISECONDS>ms
    this.typingTimeout = setTimeout(x => {
      const input = event.target.text;
      if (input !== '') {
        this.updateInformation(true);
      }
    }, 500);
  }

  onLanguageChange() {
    this.updateInformation(this.termManuallyEntered, undefined, false);
  }

  public updateInformation(termManuallyEntered: boolean, wordAndModality?: object, log?: boolean): void {
    const input = wordAndModality ? wordAndModality['sourceWord'] : undefined;
    const interactionModality: InteractionModality = wordAndModality ? wordAndModality['interactionModality'] : undefined;

    if (input !== undefined) {
      $('#text-input-linguee')[0].value = input;
    }

    const word = $('#text-input-linguee')[0].value;

    if (word !== '') {

      this.termManuallyEntered = termManuallyEntered;
      const url = this.baseUrl + '?word=' + word + '&from=' + this.from.toLowerCase() + '&to=' + this.to.toLowerCase();

      this.httpClient.get(url).subscribe(
          response => {

            this.searchTerm = word;
            this.error = response['words'].length === 0;
            this.response = response;

            if (log !== false) {
              if (termManuallyEntered) {
                this.log.logDictionaryCall(InteractionModality.KEYBOARD, word, response);
              } else {
                this.log.logDictionaryCall(interactionModality, word, response);
              }
            }
          },
          err => {

            this.searchTerm = word;
            this.error = true;

            if (log !== false) {
              if (termManuallyEntered) {
                this.log.logDictionaryCall(InteractionModality.KEYBOARD, word, err);
              } else {
                this.log.logDictionaryCall(interactionModality, word, err);
              }
            }
          }
      );
    }
  }

}
