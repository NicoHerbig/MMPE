interface Offset {
  top: number;
  left: number;
}

/**
 * Get overall offset to the top between the element, all of its parents, until reaching segment-detail.component.
 * @param el - the element to determine the offset of
 */
export function getOffsetTop(el: HTMLElement): number {
  let y = 0;
  while (el && !isNaN(el.offsetTop)) {
    y += el.offsetTop - el.scrollTop;
    el = el.offsetParent as HTMLElement;
  }
  return y;
}

export function getTopDifference(elAbove: HTMLElement, elBelow: HTMLElement): number {
  const offsetElBelow: number = getOffsetTop(elBelow);
  const offsetElAbove: number = getOffsetTop(elAbove);
  return offsetElAbove - offsetElBelow;
}

export function getTopDifferenceDOMRect(elAbove: DOMRect, elBelow: HTMLElement): number {
  const offsetElBelow: number = getOffsetTop(elBelow);
  const offsetElAbove: number = elAbove.top + window.pageYOffset;
  console.log(offsetElAbove, offsetElBelow);
  return offsetElAbove - offsetElBelow;
}

/**
 * Get overall offset, i.e. the element's offset and the offset of all of its parents.
 * @param el - the element to determine the offset of
 */
export function getOffset(el: HTMLElement): Offset {
  let x = 0;
  let y = 0;
  while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
    x += el.offsetLeft - el.scrollLeft;
    y += el.offsetTop - el.scrollTop;
    el = el.offsetParent as HTMLElement;
  }
  return { top: y, left: x };
}

/**
 * Build the bounding recangle around the element, and return its center.
 * @param el - the element to determine the center of
 */
export function getCenterPointBoundingRect(el: HTMLElement): [number, number] {
  const rect = el.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  return [centerX, centerY];
}

/**
 * Find the element at the given position
 * @param x - the x coordinate
 * @param y - the y coordinate
 */
export function findElementUnderneath(x: number, y: number): HTMLElement {
  // What is beneath it?
  const elementsUnderneath = document.elementsFromPoint(x, y);
  let elementUnderneath: HTMLElement = null;
  for (const el of elementsUnderneath) {
    if (el && el.nodeName === 'SPAN' && !el.classList.contains('dragging') && el.id.startsWith('mainDivSpan')) {
      elementUnderneath = el as HTMLElement;
      break;
    }
  }

  // if it is non-trivial to find the element underneath, check if it was the mainDiv, and if so infer the closest span
  if (elementUnderneath === null) {
    let mainDivEl: HTMLElement = null;
    // is the mainDiv underneath?
    for (const el of elementsUnderneath) {
      if (el && el.nodeName === 'DIV' && el.id === 'mainDiv') {
        mainDivEl = el as HTMLElement;
        break;
      }
    }
    // if it is underneath, infer the closest span
    if (mainDivEl) {
      // find mainDivSpans in same line
      const spansInSameLine = [];
      for (let child = mainDivEl.firstChild as HTMLElement; child !== null; child = child.nextSibling as HTMLElement) {
        if (child && child.nodeName === 'SPAN' && !child.classList.contains('dragging') && child.id.startsWith('mainDivSpan')) {
          const centerOfChildY = getCenterPointBoundingRect(child)[1];
          if (Math.abs(centerOfChildY - y) < child.offsetHeight / 2) {
            spansInSameLine.push(child);
          }
        }
      }
      // check for closest one in same line in terms of x
      let closest: HTMLElement;
      let bestDist = 300; // must be at least within 300 px
      for (const el of spansInSameLine) {
        const centerOfChildX = getCenterPointBoundingRect(el)[0];
        const dist = Math.abs(centerOfChildX - x);
        if (dist < bestDist) {
          closest = el;
          bestDist = dist;
        }
      }
      // if you found something, use it as elementUnderneath
      if (closest) {
        elementUnderneath = closest;
      }
    }
  }

  // in any case return what was found
  return elementUnderneath;
}


