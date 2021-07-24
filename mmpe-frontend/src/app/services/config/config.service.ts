import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  private appConfig: any;

  constructor(private http: HttpClient) { }

  loadAppConfig() {
    return this.http.get('/assets/config.json')
      .toPromise()
      .then(data => {
        this.appConfig = data;
      });
  }

  get myScriptApplicationKey() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.myScriptApplicationKey;
  }

  get myScriptHmacKey() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.myScriptHmacKey;
  }

  get enableTouchMode() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.enableTouchMode;
  }

  get enableQualityEstimation() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.enableQualityEstimation;
  }

  get myScriptLanguage() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.myScriptLanguage;
  }

  get email_IDs() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.email_IDs;
  }
  get passwords() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.passwords;
  }
  get projects() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.projects;
  }
  get enableSpeech() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.enableSpeech;
  }

  get enableEyeTracking() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.enableEyeTracking;
  }

  get enableWhiteSpace() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.enableWhiteSpace;
  }

  get enableSpellcheck() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.enableSpellcheck;
  }

  get enableHandwriting() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.enableHandwriting;
  }

  get enableMidairGestures() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.enableMidairGestures;
  }

  get speechLanguage() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.speechLanguage;
  }

  get speechModelCustomizationID() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.speechModelCustomizationID;
  }

  get enableIPE() {
    if (!this.appConfig) {
      throw Error('Config file not loaded!');
    }
    return this.appConfig.enableIPE;
  }
  
}
