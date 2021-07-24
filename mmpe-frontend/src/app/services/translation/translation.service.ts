import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {Observable} from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
//import { of } from 'rxjs/observable/of';
import {Translation} from '../../model/translation';

@Injectable({
  providedIn: 'root'
})



export class TranslationService {

  httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json'})
  };

  public numOfHypothesis = null;


  private translationUrl = 'http://localhost:3000/alternatives';  // URL to web api

  constructor( private http: HttpClient) { }
  getTranslation(source, num_hyp, target_prefix, reference) {
    //debugger;
    console.log('RE457 accessing data now target prefix', target_prefix);
    const url = `${this.translationUrl}`;
     return this.http.post(url, {source, num_hyp, target_prefix, reference}, this.httpOptions)
    .toPromise()
    .then((res) => {
      console.log("res:", res)
      this.numOfHypothesis = res;     
      console.log(" successfully fetch hypothesis from Ctranslate2:",  this.numOfHypothesis);
      return res;   
    }).catch((error)=>{
      console.log("data not found from ctranslate2" + JSON.stringify(error));
      return false;
    }); 
  }

}
