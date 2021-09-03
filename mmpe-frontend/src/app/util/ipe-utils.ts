import {SegmentDetailComponent} from '../components/segment-detail/segment-detail.component'; 

//Highlighting minor changes
export function getNewWords(ref, hyp) {

  var refArray = ref.split(" ");
  var hypArray = hyp.split(" ");

  var refArray1 = ref.split(" ");
  var hypArray1 = hyp.split(" ");

  let newWords = [];
  var myOutputHTML = "";

  //Loop to highlight newly inserted words
  for(let i = 0; i < hypArray.length; i++) {
    let currentWord = hypArray[i];
    let index = refArray.findIndex(word => word == currentWord);
    if(index == -1) {

      newWords.push({word: currentWord, pos:i, html: "<span class='new'>" + currentWord + "</span>"});
      hypArray.splice(i, 1);
      i = i - 1;

    } else {
      newWords.push({word: currentWord, pos:i, html: "<span class='normal'>" + currentWord + "</span>"});
      refArray.splice(index, 1);
    }
  }

  //Loop to highlight the deleted words
  for(let i = 0; i < refArray1.length; i++) {
    let currentWord = refArray1[i];
    let index = hypArray1.findIndex(word => word == currentWord);
    if(index == -1) {
      newWords.splice(i, 0, {word: currentWord, pos:i, html: "<span class='del'>" + currentWord + "</span>"});
    }
  } 

  newWords.map((item) => {
    myOutputHTML += item.html + " ";
  })
  return (myOutputHTML);

}//end function here

//Call function to highlight major changes
export function getNewWordsFromMajorChanges(ref, hyp) {

  var refArray = ref.split(" ");
  var hypArray = hyp.split(" ");

  var refArray1 = ref.split(" ");
  var hypArray1 = hyp.split(" ");
  
  let newChangeWords = [];
  var myOutputHTML = "";

  //Loop to highlight the newly inserted words
  for(let i = 0; i < hypArray.length; i++) {
    let currentWord = hypArray[i];
    let index = refArray.findIndex(word => word == currentWord);
    if(index == -1) {
      
      newChangeWords.push({word: currentWord, pos:i, html: "<span class='new'>" + currentWord + "</span>"}); 
      hypArray.splice(i, 1);
      i = i - 1; 
    } else {
      newChangeWords.push({word: currentWord, pos:i, html: "<span class='normal'>" + currentWord + "</span>"});
      refArray.splice(index, 1);
    }
  }
  
  //Loop highlight the deleted words
  for(let i = 0; i < refArray1.length; i++) {
    
    let currentWord = refArray1[i];
    let index = hypArray1.findIndex(word => word == currentWord);
    if(index == -1) {
      newChangeWords.splice(i, 0, {word: currentWord, pos:i, html: "<span class='del'>" + currentWord + "</span>"});
    }
  } 

  newChangeWords.map((item) => {
    myOutputHTML += item.html + " ";
  })
  return (myOutputHTML);
}

export function comparison(sentence1, sentence2) {

    let sent1 = sentence1.trim().split(" ").filter(x => x !== '');
    let sent2 = sentence2.trim().split(" ").filter(x => x !== '');
   
    //A = 1, D = 2, S = 3,

    let comp1Array = this.compSent1(sent1, sent2);
    let comp2Array = this.compSent2(sent1, sent2, comp1Array);
    return {comp1Array, comp2Array};

  }

export function compSent1(sent1, sent2) {
    //debugger;
    let i = 0;
    let j = 0;
    let compArray = [];
    while(i < sent1.length) {
      let a = sent1[i];
      let b = sent2[j];
      if(a == b) {
          //same word
          compArray.push(0);
      } else {
          compArray.push(2);
      }
      i++;
      j++;
    }
    return compArray;
  }
  
export function compSent2(sent1, sent2, comp1Array) {
    let i = 0;
    let j = 0;
    let compArray = [];
    while(j < sent2.length) {
      let a = sent1[i];
      let b = sent2[j];
      if(a == b) {
        compArray.push(0);
      } else {
        // compArray.push(1);
        let shiftedIndex = sent1.indexOf(b);
        if(shiftedIndex == -1) {
          compArray.push(1);
        } else {
          compArray.push(0);
        }
      }
      i++;
      j++;
    }
  return compArray;
}

 export function category(comp, comp2) {
    
  var filtered_comp = comp.filter(x => x != 0);
  var filtered_comp2 = comp2.filter(x => x != 0);
  
  if (filtered_comp.length == 0) {
    return 0;
  }

  if(filtered_comp2.length == 1 && filtered_comp2[0] == 1) {
    return 1;
  }
  let numberFound = false;
  let breakFound = false;
  for (let index = 0; index < comp2.length; index++) {
    const element = comp2[index];
    if(element != 0) {
      numberFound = true;
    }
    if(numberFound && element == 0) {
      breakFound = true;
      numberFound = false;
    }
    if(breakFound && numberFound) {
      // distance
      return 3;
    }      
  }
  // consecutive
  return 2;
}

export function highlight(ref, hyp, comp, cat) {
  var newRef = ref.trim().split(" ").filter(x => x !== '').join(' ');
  var newHyp = hyp.trim().split(" ").filter(x => x !== '').join(' ');

    return this.getNewWordsFromMajorChanges(newRef, newHyp);
}

export function HighlightDistant(ref, hyp, comp) {

  var refArray = ref.trim().replace(SegmentDetailComponent.punctuationRegEx, '').split(" ");
  var hypArray = hyp.trim().replace(SegmentDetailComponent.punctuationRegEx, '').split(" ");

  let newWords = [];
  var myOutputHTML = "";

  for(let i = 0; i < hypArray.length; i++) { //Loop highlight the new inserted words in distant changes
    let currentWord = hypArray[i];
    let index = refArray.findIndex(word => word == currentWord);
    if(index == -1 || i < index) {
      newWords.push({word: currentWord, pos:i, html: "<span class='new'>" + currentWord + "</span>"});
      hypArray.splice(i, 1);
      i = i - 1;
    } else {
      newWords.push({word: currentWord, pos:i, html: "<span class='normal'>" + currentWord + "</span>"});
      refArray.splice(index, 1);
    }
  }

  var refArray = ref.trim().replace(SegmentDetailComponent.punctuationRegEx, '').split(" ");
  var hypArray = hyp.trim().replace(SegmentDetailComponent.punctuationRegEx, '').split(" ");

  //Loop highlight the deleted words in distant changes
  for(let i = 0; i < refArray.length; i++) {
    let currentWord = refArray[i];
    let index = hypArray.findIndex(word => word == currentWord);
    if(index == -1) {
      newWords.splice(i, 0, {word: currentWord, pos:i, html: "<span class='del'>" + currentWord + "</span>"});
    }
  } 
  newWords.map((item) => {
    myOutputHTML += item.html + " ";
  })
  return (myOutputHTML);
}