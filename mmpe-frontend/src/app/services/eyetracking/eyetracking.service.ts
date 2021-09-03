import {ElementRef, Injectable} from '@angular/core';
import {SpeechService} from '../speech/speech.service';
import {LogService} from '../log/log.service';

@Injectable({
  providedIn: 'root'
})
export class EyetrackingService {

  private ws: WebSocket;
  private gazeCallback: (x: number, y: number, movableElement: ElementRef,
                         lastSrcFix: ElementRef, lastTgtFix: ElementRef,
                         componentOffsetX: number, componentOffsetY: number) => void;
  private fixationStartCallback: (x: number, y: number, movableElement: ElementRef,
                                  lastSrcFix: ElementRef, lastTgtFix: ElementRef,
                                  componentOffsetX: number, componentOffsetY: number,
                                  speechService: SpeechService) => void;
  private fixationEndCallback: (timestamp: number, duration: number, dispersion: number, x: number, y: number,
                                movableElement: ElementRef, componentOffsetX, componentOffsetY,
                                speechService: SpeechService, logService: LogService) => void;
  private movableElementGaze: ElementRef;
  private movableElementFixation: ElementRef;
  private lastSrcFixation: ElementRef;
  private lastTgtFixation: ElementRef;
  private componentOffsetX: number;
  private componentOffsetY: number;
  private speechService: SpeechService;

  constructor(private logService: LogService) {
    this.ws = new WebSocket(getBaseLocation());
    this.ws.onopen = () => {
      console.log('Connected to eyetracking websocket server');
    };
    this.ws.onclose = () => {
      console.log('Closed connection to eyetracking websocket server');
    };
    this.ws.onmessage = (msg) => { this.handleIncomingEyeData(msg); };
  }

  public handleIncomingEyeData(msg: MessageEvent) {
    if (msg.isTrusted) {
      if (msg.data.startsWith('CLOSED')) {
        console.log('The server closed the connection to the eye tracker');
      } else {
        const payload: string = msg.data;
        // console.log('Received msg from eye tracker:', payload);

        try {
          const eyeJson = JSON.parse(payload);
          if ('gaze' in eyeJson) {
            const gazeJson = eyeJson.gaze;
            const ts = gazeJson.ts;
            // handle raw gaze event
            if (gazeJson.left && gazeJson.right && gazeJson.left.gaze.valid === 1 && gazeJson.right.gaze.valid === 1) {
              const leftX = gazeJson.left.gaze.x;
              const leftY = gazeJson.left.gaze.y;
              const rightX = gazeJson.right.gaze.x;
              const rightY = gazeJson.right.gaze.y;
              // average them
              const screenX = (leftX + rightX) / 2;
              const screenY = (leftY + rightY) / 2;
              // send screen coords
              this.gazeCallback(screenX, screenY, this.movableElementGaze, this.lastSrcFixation, this.lastTgtFixation,
                this.componentOffsetX, this.componentOffsetY);
            }
            // diameter
            if (gazeJson.left && gazeJson.right && gazeJson.left.pupil.valid === 1 && gazeJson.right.pupil.valid === 1) {
              const rightDiam = gazeJson.right.pupil.diam;
              const leftDiam = gazeJson.left.pupil.diam;
              this.logService.logPupilDiameter(ts, leftDiam,  rightDiam);
            }
          } else if ('fixationStart' in eyeJson) {
              const fixJson = eyeJson.fixationStart;
              // handle raw gaze event
              if (fixJson.x && fixJson.y && fixJson.ts) {
                const x = fixJson.x;
                const y = fixJson.y;
                const ts = fixJson.ts;
                // send fixation
                this.fixationStartCallback(x, y, this.movableElementFixation, this.lastSrcFixation, this.lastTgtFixation,
                  this.componentOffsetX, this.componentOffsetY, this.speechService);
              }
          } else if ('fixationEnd' in eyeJson) {
            const fixJson = eyeJson.fixationEnd;
            // handle raw gaze event
            if (fixJson.x && fixJson.y && fixJson.duration && fixJson.dispersion && fixJson.ts) {
              const x = fixJson.x;
              const y = fixJson.y;
              const duration = fixJson.duration;
              const dispersion = fixJson.dispersion;
              const ts = fixJson.ts;
              // send fixation
              this.fixationEndCallback(ts, duration, dispersion, x, y, this.movableElementFixation,
                this.componentOffsetX, this.componentOffsetY, this.speechService, this.logService);
            }
          }
          // json also has pupil diameter, but we ignore it for now
        } catch (e) {
            console.error('Error while handling eye data:', payload);
            console.error(e.name + ': ' + e.message);
        }
      }
    }
  }

  public subscribeToEyeTracker(eyeTracker: string) {
    console.log('Telling server to subscribe to eye tracker');
    this.ws.send('subscribe:' + eyeTracker);
  }

  public unsubscribeFromEyeTracker() {
    console.log('Telling server to unsubscribe from eye tracker');
    this.ws.send('unsubscribe');
    this.movableElementGaze.nativeElement.hidden = true;
    this.movableElementFixation.nativeElement.hidden = true;
    this.lastSrcFixation.nativeElement.hidden = true;
    this.lastTgtFixation.nativeElement.hidden = true;
  }

  public registerEyeDataCallbacks(callbackGaze: (x: number, y: number, movableElement: ElementRef,
                                                 lastSrcFix: ElementRef, lastTgtFix: ElementRef,
                                                 componentOffsetX: number, componentOffsetY: number) => void,
                                  callbackFixationStart: (x: number, y: number, movableElement: ElementRef,
                                                          lastSrcFix: ElementRef, lastTgtFix: ElementRef,
                                                          componentOffsetX: number, componentOffsetY: number,
                                                          speechService: SpeechService) => void,
                                  callbackFixationEnd: (timestamp: number, duration: number, dispersion: number, x: number, y: number,
                                                        movableElement: ElementRef, componentOffsetX, componentOffsetY,
                                                        speechService: SpeechService, logService: LogService) => void,
                                  movableElementGaze: ElementRef, movableElementFixation: ElementRef,
                                  lastSrcFix: ElementRef, lastTgtFix: ElementRef,
                                  componentOffsetX: number, componentOffsetY: number, speechService: SpeechService) {
    this.gazeCallback = callbackGaze;
    this.fixationStartCallback = callbackFixationStart;
    this.fixationEndCallback = callbackFixationEnd;
    this.movableElementGaze = movableElementGaze;
    this.movableElementFixation = movableElementFixation;
    this.lastSrcFixation = lastSrcFix;
    this.lastTgtFixation = lastTgtFix;
    this.componentOffsetX = componentOffsetX;
    this.componentOffsetY = componentOffsetY;
    this.speechService = speechService;
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
  result = result + path + "/eyeTracking/getEyeData";
  return result;
}
