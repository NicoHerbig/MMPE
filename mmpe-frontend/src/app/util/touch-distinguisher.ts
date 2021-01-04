import {InteractionModality} from '../model/InteractionModality';

export class TouchDistinguisher {

  public static LAST_MOUSE_MOVE_TS = null;
  private static LAST_QUERIED_TS = null;
  private static LAST_INTERACTION_MODALITY: InteractionModality = null;

  public static isPenOrFinger(): InteractionModality {
    const curTS = Date.now();
    if (this.LAST_QUERIED_TS !== null && this.LAST_QUERIED_TS + 100 > curTS) {
      // someone just asked for it, give him the same reply
      // relevant for example when one starts a long pen input, because during pen down no mousemove is detected
      this.LAST_QUERIED_TS = curTS;
      return this.LAST_INTERACTION_MODALITY;
    } else {
      this.LAST_QUERIED_TS = curTS;
      console.log(TouchDistinguisher.LAST_MOUSE_MOVE_TS, curTS);
      if (TouchDistinguisher.LAST_MOUSE_MOVE_TS + 600 >= curTS) {
        this.LAST_INTERACTION_MODALITY = InteractionModality.PEN;
        return InteractionModality.PEN;
      } else {
        this.LAST_INTERACTION_MODALITY = InteractionModality.FINGER;
        return InteractionModality.FINGER;
      }
    }
  }
}
