import {CursorSelection} from './CursorSelection';

export enum ApplicationType {
  MAIN,
  HANDWRITING
}


export class UndoRedoState {

  application: ApplicationType;   // type of application (main vs. handwriting) that corresponds to this state
  targetText: string;             // current text inside mainDiv
  cursorSelection: CursorSelection; // the current cursor selection

  constructor(applicationType: ApplicationType, targetText: string, cursorSelection: CursorSelection) {
    this.application = applicationType;
    this.targetText = targetText;
    this.cursorSelection = cursorSelection;
  }

  /**
   * Can be used to add/updated the stored text cursor information
   * @param cursorSelection - the current cursor selection
   */
  public addCaretData(cursorSelection: CursorSelection) {
    this.cursorSelection = cursorSelection;
  }
}



