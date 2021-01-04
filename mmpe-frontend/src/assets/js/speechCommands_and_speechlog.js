/*
commands:
  1.replace: please(optional) replace(or it's synonyms from read_replaceJson) entity with target --->
this command replace the first word that is match with entity with target
  :((( ---2.move: please(optional) move(or it's synonyms from read_moveJson) entity before/after (and their synonyms) target
3.insertion: please(optional) insert(or it's synonyms from read_insertJson) entity after/before(and their synonyms) target.
please(optional) insert(or it's synonyms from read_insertJson) entity between(and it's synonyms) target1 and target 2.
4.delete:
*/

// ***************** replace operation start
function Replace(operation, inputText){
  var speechResultList=operation.split(" ");
  if(speechResultList[0].toLowerCase() === 'please')
  {
    speechResultList=speechResultList.splice(1);
  }
  var entity = speechResultList[1].toLowerCase();
  var target = speechResultList[3];
  var re = new RegExp("\\b" + entity + "\\b",'i')
  var result= inputText.replace(re,target);
  return result;
}
function read_replaceJson() {
  return ['replace', 'change', 'correct']
}
function replace_synonym(operation) {
  var synonyms = read_replaceJson();
  var speechResultList=operation.split(" ");
  if(speechResultList[0].toLowerCase() === 'please')
  {
    speechResultList=speechResultList.splice(1);
  }
  if(synonyms.includes(speechResultList[0].toLowerCase())){
    return true;
  }
  return false;
}
// ********************** replace operation end

// ********************** move operation start
function Move(operation, inputText){
  var result ='';
  var speechResultList=operation.split(" ");
  if(speechResultList[0].toLowerCase() === 'please')
  {
    speechResultList=speechResultList.splice(1);
  }
  var entity = speechResultList[1].toLowerCase();

  var position = speechResultList[2];
  var positionText = speechResultList[3];
  var re = new RegExp("\\b" + positionText + "\\b",'i')
  var index_positionText = inputText.search(re);
  var re_entity = new RegExp("\\b" + entity + "\\b",'i')
  var index_entityText = inputText.search(re_entity);

  if(index_positionText >=0 && index_entityText>=0)
  {
    if(move_afterSynonym(position) == true)
    {
      result = inputText.substring(0,index_positionText+ positionText.length)+ ' '+ entity +inputText.substring(index_positionText+ positionText.length);
    } else if(move_beforeSynonym(position) == true )
    {
      result = inputText.substring(0,index_positionText)+entity+' ' + inputText.substring(index_positionText);
    } else if(move_betweenSynonym(position) == true)
    {
      var re_bn=new RegExp("\\b" + speechResultList[5] + "\\b",'i');
      var index_bn = inputText.search(re_bn);
      if(index_bn >= 0)
      {
        result = inputText.substring(0,index_positionText+ positionText.length+1)+entity+' '+inputText.substring(index_positionText+ positionText.length+1);
      }
      else
      {
        result = 'could not recognise your words properly';
      }
      console.log(index_entityText);
      console.log(index_bn);
      console.log(result);
    }

    result = result.replace(re_entity,"");
  }
  else
  {
    result = 'could not recognise your words properly';
  }
  return result;
}
function read_moveJson(){
  return ["move"];
}
function move_afterSynonym(position){
  var synonyms = ["after"];
  if (synonyms.includes(position)){
    return true;
  }
  return false;
}
function move_beforeSynonym(position){
  var synonyms = ["before"];
  if (synonyms.includes(position)){
    return true;
  }
  return false;
}
function move_betweenSynonym(position){
  var synonyms = ["between"];
  if (synonyms.includes(position)){
    return true;
  }
  return false;
}
function move_synonym(operation){
  var synonyms = read_moveJson();
  var speechResultList=operation.split(" ");
  if(speechResultList[0].toLowerCase() === 'please')
  {
    speechResultList=speechResultList.splice(1);
  }
  if(synonyms.includes(speechResultList[0].toLowerCase())){
    return true;
  }
  return false;
}
// **************************move operation end

// **************************insert operation start
function Insert(operation, inputText){
  var result ="";
  var speechResultList=operation.split(" ");
  if(speechResultList[0].toLowerCase() === 'please')
  {
    speechResultList=speechResultList.splice(1);
  }
  var entity = speechResultList[1].toLowerCase();
  var position = speechResultList[2];
  var positionText = speechResultList[3];
  var re = new RegExp("\\b" + positionText + "\\b",'i')
  var index = inputText.search(re);
  var result = ''
  if(index >= 0)
  {
    if(insert_afterSynonym(position) == true)
    {
      console.log(index);
      result = inputText.substring(0,index+ positionText.length)+ ' '+ entity +inputText.substring(index+ positionText.length);
      console.log(result);

    } else if(insert_beforeSynonym(position) == true )
    {
      console.log(index);
      result = inputText.substring(0,index)+entity+' ' + inputText.substring(index);
      console.log(result);

    } else if(insert_betweenSynonym(position) == true)
    {
      var re_bn=new RegExp("\\b" + speechResultList[5] + "\\b",'i');
      var index_bn = inputText.search(re_bn);
      if(index_bn >= 0)
      {
        result = inputText.substring(0,index+ positionText.length+1)+entity+' '+inputText.substring(index+ positionText.length+1);
      }
      else
      {
        result = 'could not recognise your words properly';
      }
      console.log(index_bn);
      console.log(result);
    }
  }
  else
  {
    result = 'could not recognise your words properly';
  }

  return result;


}
function read_insertJson(){
  return ["insert", "put"];
}
function insert_afterSynonym(position){
  var synonyms = ["after"];
  if (synonyms.includes(position)){
    return true;
  }
  return false;
}
function insert_beforeSynonym(position){
  var synonyms = ["before"];
  if (synonyms.includes(position)){
    return true;
  }
  return false;
}
function insert_betweenSynonym(position){
  var synonyms = ["between"];
  if (synonyms.includes(position)){
    return true;
  }
  return false;
}
function insert_synonym(operation){
  var synonyms = read_insertJson();
  var speechResultList=operation.split(" ");
  if(speechResultList[0].toLowerCase() === 'please')
  {
    speechResultList=speechResultList.splice(1);
  }
  if(synonyms.includes(speechResultList[0].toLowerCase())){
    return true;
  }
  return false;
}
// ***********************insert operation finish

// ***********************delete operation start
function Delete(operation, inputText) {
  var result ="";
  var speechResultList=operation.split(" ");
  if(speechResultList[0].toLowerCase() === 'please')
  {
    speechResultList=speechResultList.splice(1);
  }
  var number = speechResultList[1].toLowerCase();
  speechResultList=speechResultList.splice(1);
  number = converting_numbers(number);
  var entity = speechResultList[1].toLowerCase();
  if(speechResultList.length <= 2){
    result = delete_single(entity, inputText, number);
  }else{
    result = delete_group(entity, inputText, speechResultList, number);
  }
  return result;
}

function read_deleteJson(){
  return ["delete", "throughout", "remove"];
}

function delete_synonym(operation){
  var synonyms = read_deleteJson();
  var speechResultList=operation.split(" ");
  if(speechResultList[0].toLowerCase() === 'please')
  {
    speechResultList=speechResultList.splice(1);
  }
  if(synonyms.includes(speechResultList[0].toLowerCase())){
    return true;
  }
  return false;
}
function delete_single(entity, inputText, number){
  var re = new RegExp("\\b" + entity + "\\b", 'g');
  var t=0;
  inputText= inputText.replace(re, function (match) {
    t++;
    return (t === number)? "": match
  });
  return inputText;
}
function delete_group(entity, inputText, speechResultList, number){
  var result = inputText;
  alert('delete');
  if (entity === 'group') {
    entity = speechResultList.splice(2).join(" ");
    var re = new RegExp("\\b" + entity + "\\b", 'g');
    var t=0;
    var inputText = inputText.replace(re, function (match) {
      t++;
      return (t === number) ? "" : match;
    });
    return inputText
  } else {
    entity = speechResultList.splice(1).join(" ");
    var re = new RegExp("\\b" + entity + "\\b", 'g');
    var t=0;
    var inputText = inputText.replace(re, function (match) {
      t++;
      return (t === number) ? "" : match;
    });

    return inputText
  }
}
// ******************** delete_finish

function command() {

  var result = "";
  //get the commands from ibmSpeech recognizer
  var myCommand = document.getElementById("command").value;
  var inputText= document.getElementById("mainDiv").value;
  // alert(document.getElementById("text").innerHTML);
  // alert(inputText);
  if(delete_synonym(myCommand) == true) {
    result = Delete(myCommand, inputText);
  }else if(insert_synonym(myCommand) == true){
    result = Insert(myCommand, inputText);
  }else if(move_synonym(myCommand) == true){
    result = Move(myCommand, inputText);
  }else if(replace_synonym(myCommand) == true){
    result = Replace(myCommand, inputText);
  }
  var div = document.getElementById('mainDiv');

  div.innerHTML = result;
}

function converting_numbers(number){
  var dict = {
    "first": '1',
    "second": '2',
    "third": '3',
    "fourth": '4',
    "fifth": '5',
    "sixth": 6,
    "seventh": 7,
    "eighth": 8,
    "ninth": 9
  };
  // alert(dict[number])
  return parseInt(dict[number]);
}
function getAllIndexes() {
  // var str = "hi mahsa hi hi mah hight."
  // var regex = / /gi, result, indices = [];
  // while ( (result = regex.exec(str)) ) {
  //   indices.push(result.index);
  // }
  // alert(indices);
  // return(indices);
  //return string.split(subString, index).join(subString).length;
  var inputText = 'hi mahsa hi mah hello hi mah';
  var entity = 'hi mah';
  var re = new RegExp("\\b" + entity + "\\b", 'g');
  // console.log(re);
  // var result = inputText.replace(re, "");
  // return result;
  var t=0;
  var text = inputText.replace(re, function (match) {
    t++;
    return (t === 2) ? "" : match;
  });
  // alert(text);
}

function speech_recognizer(){
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start();

      const audioChunks = [];
      mediaRecorder.addEventListener("dataavailable", event => {
        audioChunks.push(event.data);
      });

      mediaRecorder.addEventListener("stop", () => {
        const audioBlob = new Blob(audioChunks);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
      });

      setTimeout(() => {
        mediaRecorder.stop();
      }, 3000);
    });
//   var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;
//   var SpeechGrammarList = SpeechGrammarList || webkitSpeechGrammarList;
//   var SpeechRecognitionEvent = SpeechRecognitionEvent || webkitSpeechRecognitionEvent
//   var phrases = [
//     'delete',
//     'insert',
//     'put'
//   ]
//   var grammar = '#JSGF V1.0; grammar phrase; public <phrase> = ' + phrases +';';  var recognition = new SpeechRecognition();
//   var speechRecognitionList = new SpeechGrammarList();
//   speechRecognitionList.addFromString(grammar, 1);
//   recognition.grammars = speechRecognitionList;
// //recognition.continuous = false;
//   recognition.lang = 'en-US';
//   recognition.interimResults = false;
//   recognition.maxAlternatives = 1;
//
//   document.body.onclick = function() {
//     recognition.start();
//     console.log('Ready to receive a color command.');
//   }
//
//   recognition.onresult = function(event) {
//     var myCommand = document.getElementById("command");
//     var command = event.results[0][0].transcript;
//     alert('Result received: ' + command)
//     myCommand.textContent = command;
// }
}
export{
  command,
  speech_recognizer,
  getAllIndexes,
}
