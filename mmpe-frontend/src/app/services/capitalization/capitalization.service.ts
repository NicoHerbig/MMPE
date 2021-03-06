import { Injectable } from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class CapitalizationService {
  httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' })
  };

  private capitalizationUrl = getBaseLocation();  // URL to web api
  private nouns = {};

  constructor(private http: HttpClient) {
    this.getAllNouns().then(r => console.log('CapitalizationService initialized'));
  }

  // private s.t. this big request is only made once and then cached
  private async getAllNouns() {
    console.log('fetching all nouns');
    const myRequest = new Request(this.capitalizationUrl);
    this.nouns = await fetch(myRequest).then((resp) => {
      return resp.json();
    });
  }

  /**
   * Checks whether a word is a noun.
   * @param word - the word to check
   */
  public isNoun(word: string): boolean {
    return word.toLowerCase() in this.nouns;
  }

  /**
   * Capitalizes a word if it is a noun.
   * @param word - the word to check
   */
  public nounify(word: string): string {
    return this.nouns[word.toLowerCase()];
  }
}

export function getBaseLocation() {
  let url = window.location.href;
  let arr = url.split("/");
  let path = ":3000";
  let result = arr[0] + "//" + arr[2].split(":")[0];
  result = result + path + "/capitalization/getNouns_de-DE"; 
  return result;  
}

