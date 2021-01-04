import {Component, EventEmitter, OnInit, Output, ViewChild} from '@angular/core';
import {DictionaryComponent} from '../dictionary/dictionary.component';
import {InteractionModality} from '../../model/InteractionModality';
import {TouchDistinguisher} from '../../util/touch-distinguisher';

@Component({
  selector: 'app-support-tools',
  templateUrl: './support-tools.component.html',
  styleUrls: ['./support-tools.component.scss']
})
export class SupportToolsComponent implements OnInit {
  mt: string;

  @ViewChild(DictionaryComponent, {static: false}) dictionaryComponent: DictionaryComponent;
  @Output() resetMainDiv = new EventEmitter<InteractionModality>();

  constructor() { }

  ngOnInit() {
  }

  updateMT(mt: string) {
    this.mt = mt;
  }

  updateDictionaryInformation(wordAndModality: object) {
    this.dictionaryComponent.updateInformation(false, wordAndModality);
  }

  onMainDivReset(event): void {
    if (event.touches) {
      // TOUCH
      event.preventDefault();
      this.resetMainDiv.emit(TouchDistinguisher.isPenOrFinger());
    } else {
      // MOUSE
      this.resetMainDiv.emit(InteractionModality.MOUSE);
    }
  }
}
