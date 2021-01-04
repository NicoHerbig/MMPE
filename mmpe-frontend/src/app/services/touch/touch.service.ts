import { ReorderService } from './../reorder/reorder.service';
import {Injectable} from '@angular/core';
import * as $ from 'jquery';
import '../../../assets/js/jquery.hammer.js';
import {SpanService} from '../span/span.service';
import {SegmentDetailComponent} from '../../components/segment-detail/segment-detail.component';
import {LogService} from '../log/log.service';
import {InteractionSource} from '../../model/InteractionSource';
import {SpeechService} from '../speech/speech.service';
import {TouchDistinguisher} from '../../util/touch-distinguisher';
import {InteractionModality} from '../../model/InteractionModality';
import {CapitalizationService} from '../capitalization/capitalization.service';
import * as CoordCalcUtils from '../../util/coord-calc-utils';

interface RelPos {
  refEl: HTMLElement; // the reference element
  left: boolean; // whether left or right
}

enum PartOfWord {
  Left = 0,
  Right = 1,
  Middle = 2
}

@Injectable({
  providedIn: 'root'
})
export class TouchService {

  constructor(private reorderService: ReorderService) {}

  private static component: SegmentDetailComponent;
  public static registerComponent(segmentDetailComponent: SegmentDetailComponent): void {
    this.component = segmentDetailComponent;
  }

  public bindEventsToElement(el: HTMLElement) {
    // Drag and Drop for Reordering
    // Using hammerjs
    $(el).hammer({cssProps: {
        userSelect: true
      }}).bind('panstart', event => { this.reorderService.onPanStart(event); } );
    $(el).hammer({cssProps: {
        userSelect: true
      }}).bind('panmove', event => { this.reorderService.onPanMove(event); } );
    $(el).hammer({cssProps: {
        userSelect: true
      }}).bind('panend', event => { this.reorderService.onPanEnd(event); } );
    $(el).hammer({cssProps: {
        userSelect: true
      }}).bind('press', event => { this.reorderService.onPanStart(event); } );
    $(el).hammer({cssProps: {
        userSelect: true
      }}).bind('pressup', event => { this.reorderService.onPanEnd(event); } );

    // Double-tap for Deletion --> disabled right now
    // Without hammerjs, as the userSelect: true from above is required for allowing text selection,
    // but prevents the doubletap event in hammerjs to work reliably.
    // $(el).bind('touchstart', event => { this.onTap(event); });

    // also memorize touches in progress, because these are triggered both for pans and scrolls
    // if a scroll is started, touchmove is triggered before panstart, thus, we can avoid triggering the panning process
    $(el).bind('touchmove', () => { this.reorderService.touchInProgress = true; });
    $(el).bind('touchend', () => {this.reorderService.touchInProgress = false; });
  }

}
