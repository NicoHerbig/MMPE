var start_edit;
//var t2msg = '';

var opArr = [] ; //store operations
var charArr = []; // store character codes based on operations
var nextCharArr = [-1]; // character codes
var prevCharArr = [-1]; // character codes
var finalWord = [];
var textArr=[]; // whole text per operations
var posArr = [-1]; // cursors positions
var wordArr = ['']; // words where the current cursor position
var timeArr = [-1]; // timings
var preChar = '';
var nexChar = '';
var org_text='';
var del_word = '';
var ins_word = '';

function getWordAt (str, pos) {
  if (str.charAt(pos).trim().length==0)
    pos = pos-1;

  // Perform type conversions.
  str = String(str);
  pos = Number(pos) >>> 0;

  // Search for the word's beginning and end.
  var left = str.slice(0, pos + 1).search(/\S+$/);
  var right = str.slice(pos).search(/\s/);

  // The last word in the string is a special case.
  if (right < 0) {
    return str.slice(left);
  }

  // Return the word, using the located bounds to extract it from the string.
  return str.slice(left, right + pos);

}

function initialize_time() {
  start_edit = Date.now();
}

function isDelete_bp(evtobj) {
  if (evtobj.keyCode == 8) {
    return true;
  }
  return false;
}

function isDelete(evtobj) {
  if (evtobj.keyCode == 46) {
    return true;
  }
  return false;
}

function isInsert(evtobj){
  if(evtobj.keyCode == 8 || evtobj.keyCode == 46 || evtobj.keyCode == 17 || evtobj.keyCode == 91 || evtobj.keyCode == 93
    || evtobj.keyCode == 224 || evtobj.keyCode == 37 || evtobj.keyCode == 38 || evtobj.keyCode == 39
    || evtobj.keyCode == 40){
    return false;
  }
  return true;
}

function isArrowKey(evtobj) {

  if (evtobj.keyCode == 37 || evtobj.keyCode == 38 || evtobj.keyCode == 39
    || evtobj.keyCode == 40) {

    return true;

  }
  return false;
}

function isCTRL() {
  if (evtobj.keyCode == 17 || evtobj.keyCode == 91 || evtobj.keyCode == 93
    || evtobj.keyCode == 224) {

    return true;
  }
  return false;
}

function isPunc() {
  if (evtobj.keyCode > 185 && evtobj.keyCode < 222)
    return true;
  return false;

}

function reverse(str) {

  var newStr="";
  for (var i = str.length - 1; i >= 0; i--) {
    newStr += str[i]; // or newString = newString + str[i];
  }
  return newStr;
}

function DisplayEvent(e, t2msg) {
  var rawLog = "";
  var simplifiedLog = "";


  var prevCharArr_size = prevCharArr.length;
  var nextCharArr_size = nextCharArr.length;
  preChar = prevCharArr[prevCharArr_size - 1];
  nexChar = nextCharArr[nextCharArr_size - 1];

  var textarea = 'mainDiv';

  var evtobj = window.event ? event : e; //distinguish between IE's explicit event object (window.event) and Firefox's implicit.
  var unicode = evtobj.charCode ? evtobj.charCode : evtobj.keyCode;
  var text = document.getElementById(textarea).innerText;

  var re = new RegExp(String.fromCharCode(160), "g");
  text = text.replace(re, " ");


  org_text += text + "@@@@@";
  var tmp = org_text.split('@@@@');

  var cursorPosition;
  cursorPosition = getCursorPosdiv(document.getElementById(textarea));

  var curr_char = tmp[0].charAt(cursorPosition.start);
  var org_word = getWordAt(tmp[0], cursorPosition.start);

  if (evtobj.keyCode) {
    if (isDelete(evtobj) || isDelete_bp(evtobj)) {
      var op = 'D';
      var del_char = curr_char;
      var mod_word = getWordAt(text, cursorPosition.start);
      opArr.push(op);
      charArr.push(del_char);
      wordArr.push(mod_word);
      del_word += del_char;
      finalWord.push(del_word);
      if (isDelete_bp(evtobj)) del_word = reverse(del_word);
      textArr.push(org_text);
      org_text = text;
      //alert(op + ": " + del_char + '/' + del_word + '/' + org_word + '/' + mod_word);
      t2msg = 'op: ' + op + ' del char: ' + del_char + ' org word: ' + org_word + ' mod word: ' + del_word + ' time: ' + calculate_time() + '||';

    }
    if (isInsert(evtobj)) {

      //TODO blank space insertion
      var op = "I";
      mod_word = getWordAt(text, cursorPosition.start);
      if (mod_word.trim().length == 0)
        mod_word = getWordAt(text, cursorPosition.start - 1); //end insertion
      var ins_char = String.fromCharCode(unicode);
      opArr.push(op);
      charArr.push(ins_char);
      wordArr.push(mod_word);
      ins_word += ins_char;
      finalWord.push(ins_word);
      textArr.push(org_text);
      org_word = getWordAt(tmp[0], cursorPosition.start - 1); //otherwise points next word as cursor position modified
      org_text = text;
      t2msg = 'op: ' + op + ' ins char: ' + ins_char + ' org word: ' + org_word + ' mod word: ' + ins_word + ' time: ' + calculate_time() + '||';

      //alert(op + ": " + ins_char + '/' + ins_word + '/' + org_word + '/' + mod_word);

    }
    if (isArrowKey(evtobj)) { //TODO
      op = "AK";
      char = ""
      alert(op + ":" + org_word)
      del_word = '';
      ins_word = '';
      mod_word = "";

    }

  } else {//TODO
    op = "C";
    var char = ""
    var mod_word = getWordAt(text, cursorPosition.start);
    alert(op + ":" + org_word + "/" + mod_word)
    del_word = '';
    ins_word = '';
    mod_word = "";

  }

  return t2msg;
}


function reset(){
  opArr = [''] ;
  charArr = [-1];
  nextCharArr = [-1];
  prevCharArr = [-1];
  textArr = [''];
  posArr = [-1];
  wordArr = [''];
  timeArr = [-1];
  preChar = '';
  nexChar = '';
}

function showLogs() {
  /* puncArr = [',', '.', ':', ';', '!', '"', '$', '%', '&', '/', '(', ')', '=', '?', '{', '[', ']', '}', '\', '#', '+', '*', '~', '_', '|', '<', '>', ' ', &nbsp];*/
  // var puncArr = [44, 46, 58, 59, 33, 34, 36, 37, 38, 47,40, 41, 61, 63, 123, 91, 93, 125, 92, 35, 43, 42, 126, 95, 124, 60, 62, 32, 160];
  var res='';
  var original_word ='';
  var flag = '';
  for(var i =0; i<opArr.length-1; i++){

    if(opArr[i] == 'I' & opArr[i-1] !== 'I') {
      flag = 'insertion_for_change';
      original_word = wordArr[i-1];
      if(prevCharArr[i] == 32 || prevCharArr[i] == 160) {
        flag = 'insertion_start';
      }
    }
    if(opArr[i] =='I' & opArr[i+1] !== 'I') {
      if((nextCharArr[i] == 32 || nextCharArr[i] == 160) & flag =='insertion_start' ) {
        res+='inserted word is '+ wordArr[i]+'||';
      }else {
        res+=' word changed from original ' + original_word + ' to changed word ' + wordArr[i] + '||';
      }
    }
    if(opArr[i] == 'D' & opArr[i-1] !== 'D') {
      flag ='D';
      original_word = wordArr[i-1];
    }
    if(opArr[i] == 'D' & opArr[i+1] !== 'D') {
      if((nextCharArr[i-1] == 32 || nextCharArr[i-1] ==160) & (prevCharArr[i-1] == 32 || prevCharArr[i-1] == 160)) {
        res += 'deleted word is ' + original_word+ '||';
      }else if(charArr[i] == 32 ) {
        res +='combined word from ' + original_word + ' to changed word ' + wordArr[i]+'||';
      }else{
        res +='changed word from ' + original_word + ' to changed word ' + wordArr[i]+'||';
      }
    }
    if(opArr[i] == 'C' ) {
      original_word = wordArr[i];
      if((charArr[i] === 32 || charArr[i] === 160) & (nextCharArr[i] !== 32 & nextCharArr[i] !== 160)){
        res+='word seperation ' + wordArr[i-1] + ' to ' + wordArr[i] +'||';
      }
    }
  }
  i=opArr.length-1
  if(opArr[i] =='I') {
    if((nextCharArr[i] === 32 || nextCharArr[i] === 160) & flag ==='insertion_start' ) {
      res+='inserted word is '+ wordArr[i]+'||';
    }else {
      res+=' word changed from original ' + original_word + ' to changed word ' + wordArr[i] + '||';
    }
  }
  if(opArr[i] === 'D') {
    if((nextCharArr[i-1] === 32 || nextCharArr[i-1] === 160 ) & (prevCharArr[i-1] === 32 || prevCharArr[i-1] === 160)) {
      res += 'deleted word is ' + original_word+ '||';
    }else if(charArr[i] === 32 || charArr[i] === 160) {
      res +='combined word from ' + original_word + ' to changed word ' + wordArr[i]+'||';
    }else{
      res +='changed word from ' + original_word + ' to changed word ' + wordArr[i]+'||';
    }
  }
  alert(res);
  return res;
  reset();
}


export {
  initialize_time,
  DisplayEvent,
  showLogs,
}

