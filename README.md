![MMPE-Logo](/assets/imgs/mmpe-logo.png)

# MMPE
The shift from traditional translation to post-editing (PE) of machine-translated (MT) text can save time and reduce errors, but it also affects the design of translation interfaces, as the task changes from mainly generating text to correcting errors within otherwise helpful translation proposals. Since this paradigm shift offers potential for modalities other than mouse and keyboard, we present MMPE, the first prototype to combine traditional input modes with pen, touch, and speech modalities for PE of MT. Users can directly cross out or hand-write new text, drag and drop words for reordering, or use spoken commands to update the text in place. All text manipulations are logged in an easily interpretable format to simplify subsequent translation process research.

This project was funded in part by the German Research Foundation (DFG) under grant number GE2819/2-1 (project MMPE).

## Table of content

- [Repository overview](#repository-overview)
- [Requirements](#requirements)
- [Configuration](#configuration)
- [Running the repository](#running-the-repository)
- [Create translation projects](#create-translation-projects)
- [Contact](#contact)
- [Troubleshooting during installation](#troubleshooting)
- [Hardware](#hardware)
- [Template](#template)
- [Further reading](#further-reading)
- [Notes regarding logging](#logging)
- [Notes regarding touch and pen functionality](#touch-and-pen)
- [Notes regarding eye tracking functionality](#eye-tracking)
- [Notes regarding speech and multi-modal functionality](#speech-and-multi-modal)
- [Notes regarding mid-air gesture functionality](#mid-air-gesture)
- [Notes on deployment of the application on the remote server](#deployment)


## Repository overview <a name="repository-overview"></a>
While the project is called front-end, it actually does contain a very simply server as well.
The structure is:
- mmpe-frontend: contains the Angular project which really is the frontend
- mmpe-server: contains a simple node.js server responsible for project load & store, 
as well as microservices like spellchecking

## Requirements <a name="requirements"></a>
- node.js
- Angular CLI
- Ensure that git and python are in PATH.

## Configuration <a name="configuration"></a>
The projects won't really work without configuration. We prepared dummy config files that you can use as a basis:
- copy the file mmpe-frontend/src/assets/config.json.example to mmpe-frontend/src/assets/config.json (copy and remove the .example)
    - for the project to run, you have to at least copy the example file
    - to see translation projects, create them in mmpe-server/data/projects. You can use project1.json.example and remove the ".example" part to get a starting point. For more information on projects, check the section here in this Readme.
    - to log in: add emails, passwords, and projects to the corresponding arrays
        - the email and password pairs at the same positions in the array allow you to log in
        - the list of integers at the same position in the projects defines which projects to see. They all start with "project" followed by the specified id.
        - be aware that the currently implemented log in mechanism is BY NO MEANS SECURE. For running internal studies this will do, but DO NOT HOST THE PROJECT AND BELIEVE IT TO BE SECURE!
    - Deactivate features: MMPE has a lot features, from which you might not need or want all. To easily deactivate those, use the variables: "enableSpeech", "enableEyeTracking", "enableWhiteSpace", "enableSpellcheck", "enableHandwriting", "enableMidairGestures"
    - to use handwriting: get a myScript application and hmac key, insert the credentials, and define the target language
    - to use speech: additionally set the "speechLanguage" and if you have custom IBM Watson model, the "speechModelCustomizationID"

- copy the file mmpe-server/config.json.example to mmpe-server/config.json (copy and remove the .example)
    - if you do not want to use speech input, just copy the config example, but a file is needed for the server to run
    - if you want to use speech, create credentials on the IBM Watson website and insert them here

## Running the repository <a name="running-the-repository"></a>
- go into each folder separately and run 'npm install'
- then run both projects using 'npm start' (or a run configuration in your IDE)
- open Chrome on localhost:4200 (other browsers most likely work too, but we tested on Chrome)


Careful: while mmpe-frontend automatically rebuilds on changes, mmpe-server does not. If you want that, you can use nodemon or similar tools. Or simply restart after changes.

To deploy the project (instead of running it for development), see the instructions below.

## Create translation projects <a name="create-translation-projects"></a>
Translation projects need to be stored in mmpe-server/data/projects. 
You can use project1.json.example and remove the ".example" part to get a starting point. 
To see the project in the interface, the user you log in with needs to have the project id in the list of projects within mmpe-frontend/src/assets/config.json, as described above.

A translation project is simply a JSON file with the following structure:
```json
{
	"projectid": 1,
	"projectname": "Project1",
	"segments": [{
		"id": 1,
		"source": "Customers who once sold their vinyl to buy CDs are now selling their CDs to buy their records back, he says.",
		"target": "Zu ddie ihre CDs, Aufzeichnungenzurückzukaufen tzt ihre um &quot;, sagt er.",
		"mt": "Kunden, die früher ihre Vinyl verkauften, um CDs zu kaufen, verkaufen jetzt ihre CDs, um ihre Aufzeichnungen zurückzukaufen &quot;, sagt er.",
		"sourceLanguage": "EN-US",
		"targetLanguage": "DE-DE",
		"segmentStatus": 0
	    }, 
	    ...
	    ]
}
```

- "projectid" must be unique and is used to access the project in the url. It is also added to every log entry. The filename should also be project<ProjectId>.json
- "projectname" the name that is displayed at the top left when editing
- "segments" is an array of individual segments:
    - "id" is shown on the very left
    - The "source" is what will be displayed on the left
    - The "target" will be displayed on the right and change upon edits in the interface. 
    - "mt" is just there to support reverting to it using a button in the support tools.
    - "sourceLanguage" and "targetLanguage" are currently not used but could be displayed somewhere if required.
    - "segmentStatus" defines the status of the segment which is displayed as an icon between source and target. It can be Confirmed = 0, Unconfirmed = 1, or Active = 2.

For certain studies, it might make sense to tell the translator what to do. We did that in the ACL study. For this, we implemented a pop-up appearing before each segment. If you want something like that, just add the following to each segment:
```json
        "studyOperation": "REPLACE",
		"studyTrial": true,
		"studyCorrection": "In die große Übersichtskarte <span class=\"wrong\">wurde</span><span class=\"correct\">wurden</span> für Städte und Gemeinden detailliertere Karten, sogenannte Urpositionsblätter, eingearbeitet.",
		"studyModality": "Pen",
```
which will lead to the following popup:

![Popup](/assets/imgs/popup-modality.png)

The popup simply shows the "studyOperation" followed by the "studyModality" in the header, then the "source", "mt", and "correction".
Times between clicking the START button and confirming a segment are logged. "studyTrial" is for logging, so that you can for example exclude the data from the first few segments.

To generate projects with these additional fields, latin square balancing, etc. the mmpe-server/data/projectGenerator/projectGenerator.js can be used.

Note: Projects should NOT BE PUSHED and are therefore under .gitignore. 

## Contact <a name="contact"></a>
This project has only recently been open-sourced. If you feel like the documentation or code could be improved (which I am sure it can), please either get actively involved through issues and merge requests. Or, if you aren't a developer, simply contact me ([Nico Herbig](mailto:nico.herbig@dfki.de)). I'll be happy to help and also thankful for useful feedback. 

## Troubleshooting during installation <a name="troubleshooting"></a>
**1. Downloading binary SASS**

*Error:*

Downloading binary from https://github.com/sass/node-sass/releases/download/v4.11.0/darwin-x64-72_binding.node
Cannot download "https://github.com/sass/node-sass/releases/download/v4.11.0/darwin-x64-72_binding.node": 
 HTTP error 404 Not Found

*Solution:*

If github.com is not accessible in your location try setting a proxy via HTTP_PROXY, e.g. 

a. Download: darwin-x64-72_binding.node from https://github.com/sass/node-sass/releases/

b. export SASS_BINARY_PATH=~PATH/darwin-x64-72_binding.node

c. npm install

-----------------------

**2. TS1086: Aceessor cannot be declared**

*Error:*

TS1086: An accessor cannot be declared in ambient context

*Solution:*

Update the @angular/cli using the command : ng update –next @angular/cli  --force

This updates all the peer dependencies as well. Update (Upgrade/downgrade) packages (Using ng update) to be compatible with the angular cli version. 

-----------------------

**3. Uncaught TypeError: Cannot read property 'prototype'  OR 'superCtor is undefined' at inherits**

*Error:*

Uncaught TypeError: Cannot read property 'prototype' of undefined at inherits (inherits_browser.js:5)

OR

superCtor is undefined (inherits inherits_browser.js)

*Solution:*


modify the line 'var Readable = require('stream').Readable;' in index.js of readable-blob-stream to 'var Readable = require('readable-stream').Readable;'
More about the error is given here: https://stackoverflow.com/questions/60779965/typeerror-superctor-is-undefined-inherits-inherits-browser-js?noredirect=1#comment107536930_60779965
 
## Hardware <a name="hardware"></a>
![Apparatus](/assets/imgs/apparatus.jpeg)

The project is based on web-technolgies, so in principle all you need is a browser. However, depending on the features you want to use, we recommend the following:

- a large tiltable touch and pen screen (we used the Wacom Cintiq Pro 32, but others should also work).
- an external headset. In our experience microphones integrated in laptops often yield bad transcriptions, thereby severely impacting the speech recognition functionality.
- an Eye Tracker. Scripts for the Tobii 4C are available. Support for other eye trackers can be easily added, see below.
- a Leap Motion for mid-air gestures

## Template <a name="template"></a>
The HTML/CSS/JS template used for this project can be found ![here](https://startbootstrap.com/theme/creative)

If you want to add further UI elements, it might make sense to look in the template for nice-looking alternatives.


## Further reading <a name="further-reading"></a>
Before getting started, we recommend to look at the following papers/blog posts. These will introduce all the features.

- [A blog post on MMPE in Kirti Vashee' "eMpTy Pages"](http://kv-emptypages.blogspot.com/2020/10/the-evolving-translator-computer.html)
- [A long version of the prototype focusing on the improvements after a study we ran](https://umtl.cs.uni-saarland.de/paper_preprints/paper_herbig_improving_MMPE.pdf)
- [A demo paper at ACL, short, focusing on the prototype, but without the latest changes](https://umtl.cs.uni-saarland.de/paper_preprints/paper_herbig_mmpe_acl_demo.pdf)
- [The ACL full paper, focusing on an evaluation with the prototype in the demo paper](https://umtl.cs.uni-saarland.de/paper_preprints/paper_herbig_mmpe_acl_full.pdf)
- [The original elicitation study, which guided the initial design of the prototype](https://umtl.cs.uni-saarland.de/paper_preprints/paper_herbig_mmpe_acl_full.pdf)

These and more publications can also be found on the [MMPE Website](https://mmpe.dfki.de)

## Notes regarding logging <a name="logging"></a>
We support extensive logging functionality. On the one hand, actual keystrokes, touched pixel coordinates, and other events are logged and all UI interactions (like segmentChange or undo/redo/confirm) are stored, allowing us to analyze the translator’s use of MMPE. Most importantly, however, we also log all text manipulations on a higher level to simplify text editing analysis.

For insertions, we log whether a single or multiple words were inserted, and add the actual words and their positions as well as the segment’s content before and after the insertion to the log entry.

Deletions are logged analogously, and for reorderings, we save the old and the new position of the moved word(s) to the log entry.
Last, for replacements, we log whether only a part of a word was replaced (i.e., changing the word form), whether the whole word was replaced (i.e., correcting the lexical choice), or whether a group of words was replaced. The logs for copy and paste have been improved by adding the clipboard content.

In all cases, the word(s) before and after the change, as well as their positions and the overall segment text, are specified in the log entry. Furthermore, all log entries contain the modality of the interaction, e.g., speech or pen, thereby allowing the analysis
of which modality was used for which editing operation. All log entries with timestamps are created within the client and sent to the server for storage in a JSON file.

The logging functionality was extended, such that times between clicking “Start” and confirming the segment were also logged. Furthermore, logging for multimodal commands: We do not merely save whether the interaction was multi-modal, but store whether it was a combination of speech and pen, or speech and mouse, or speech and finger touch.

![Logging of text manipulations in an easily interpretable granularity](/assets/imgs/logging.PNG)


## Notes regarding touch and pen functionality <a name="touch-and-pen"></a>
![Handwriting](/assets/imgs/handwriting.png)

![Touch Selection](/assets/imgs/touchSelect.jpg)

![Touch Reordering](/assets/imgs/touchReorder.jpg)

**Configuring myScript**
For handwriting recogntion, we use the myScript API. You first need to get your credentials by registering on their site.
Then insert the retrieved myScriptApplicationKey and myScriptHmacKey in mmpe-frontend/src/assets/config.json as in the example in mmpe-frontend/src/assets/config.json.example.
You can also define the language there using myScript's language codes. Note however, that we only ran studies with de_DE as target language yet, so test well if you change this value.

**Configuring Windows**
By default Windows offers a handwriting recognition. As we are using myScript, we decided to disable this. To know how, 
see https://superuser.com/questions/951229/how-to-disable-windows-10-handwritting-dialog  
Note: If you are using a German Windows, the service you are looking for is called 'Dienst für Bildschirmtastatur und Schreibbereich'.

If your finger touches are sent to the wrong screen, go to Tablet-PC settings on Windows 10, and click setup. If you cannot find these settings, open run and type shell:::{80F3F1D5-FECA-45F3-BC32-752C152E456E}.

**Configuring Cintiq Screens**
The button in the pen was confusing for some participants who accidentally pushed it. 
We therefore recommend deactivating it in the Cintiq settings.

## Notes regarding eye tracking functionality <a name="eye-tracking"></a>
![Eye Tracking](/assets/imgs/eyeTracking_part.png)

As an eye tracker, we currently only support the Tobii 4C with Pro SDK:
- Install the Tobii Software on your PC
- Calibrate the eye tracker for every participant
- Activate eye tracking in the client

We are currently also working on a Pupil integration, as you can see in the frontend. Whatever you select there in the dropdown will lead to an execution of the corresponding python script on in mmpe-server/eyeTracking/python.
This is all pretty experimental so far, but works quite good. 

The TobiiProIntegration.py shows an example of how eye trackers can be integrated. Basically the script only creates two types of events:
- Gaze events, like {'gaze': {'ts': <someTimeStamp>, 'left': {'gaze': {'x': <someXValue>, 'y': <someYValue>, 'val': <ifTheGazeIsValid>, 'pupil': {'diam': <theDiameter>, 'valid': <aValidityScore>}, 'right': {'gaze': {'x': <someXValue>, 'y': <someYValue>, 'val': <ifTheGazeIsValid>, 'pupil': {'diam': <theDiameter>, 'valid': <aValidityScore>}}}
    - the data is simply fetched using the Eye Tracker SDK
- Fixation events  
    - {'fixationStart': {'x': <centerOfFixationX>, 'y': <centerOfFixationY>, 'ts': <timestamp>}}
    - {'fixationEnd': {'x': <centerOfFixationX>, 'y': <centerOfFixationY>, 'duration': <fixationDuration>, 'dispersion': <fixationDispersion>, 'ts': <timestamp>}}
    - These are calculated using a simple dispersion algorithm in the file. The algorithm itself could also be moved in another file and reused by other eye trackers

These events are simply forwarded to the mmpe-frontend's eye service. 
- gaze events are simply visualized (the orange circle in the image above)
- fixation events are used for 2 purposes
    - inform the speech service if a fixation happened on the currently edited target view, so that simplified multi-modal commands can be executed. In the image above, the yellow circle on the target shows the last fixation, and the yellow highlighted word the word that this fixation was mapped to.
    - memorize and visualize the last fixation on the source and target to help the translator find where s/he left off. In the image above, the yellow circle on the source is such a fixation.



## Notes regarding speech and multi-modal functionality <a name="speech-and-multi-modal"></a>
![Before Speech Command](/assets/imgs/speechBefore.png)

![After Speech Command](/assets/imgs/speechAfter.png)


When activating speech, the browser will ask you for permission to access a microphone. Make sure to the best microphone you have from the list (if you have multiple ones).

Speech is then being recorded and streamed from mmpe-frontend to mmpe-server, and from there to IBM Watson servers. To make this work, you need to specify the fields in the mmpe-server/config.json. To see how the file should look, see the mmpe-server/config.json.example.
Insert your credentials and speech model in that file.

Furthermore, specify the speech language in mmpe-fronend/src/assets/config.json, e.g. 'de-De'. IBM Watson also offers customization, e.g. to train a model more towards the MT text can help to improve the transcription. If you do that on their platform, you can insert the customization ID as a string in the same config under "speechModelCustomizationID".

Now the mmpe-server receives a transcription from IBM Watson, which he forwards to mmpe-client's speech.service.ts. This speech service now uses speech commands to interpret the transcription. We tried to keep the commands and the source code separate. See below "Supporting further languages for speech interaction" for further information on the commands.

![Before Multi-Modal Speech Command](/assets/imgs/multiModalBefore.png)

![After Multi-Modal Speech Command](/assets/imgs/multiModalAfter.png)

The speech.service.ts is also informed about interactions from other modalities, like cursor placement through mouse, keyboard, touch, pen, or just the fixations from eye tracking. It uses this to support simplified commands where the entitiy is specified through the other modality.

### Supporting further languages for speech interaction

The speech commands can be found in mmpe-server/ibmSpeech/jsonFiles. The commands file there specifies the operations that can be done. The synonyms file, specifies synonyms for the commands. As you see, the commands.json is kept in english, but this is not actual english but just placeholders that are used to map real words using the synonyms file. As we ran our experiments in German, we currently only have a synonyms_de-DE.json file. In theory, similar files can be quickly created for any language, but we have not seriously tested this. We are however, happy to support your efforts to integrate further languages.

Here is quick description of the synonym_de-DE.json file, which can help create similar files for other languages:

The synonym_de-DE.json file assists in mapping target language (German) speech commands to its corresponding commands in commands.json, which are then processed to obtain the final result. This JSON file should be rather intuitive: it supports various operations like delete, insert, move, replace, confirm, undo and redo. Each of these operations are mapped to multiple words in the target language. Similarly, there are number and keyword mappings to support multimodal commands like "Lösche zwei wörter.", "ersetze vier wörter durch Kunden." and "Bewege vier wörter nach Kunden.". Furthermore, keyword and count mappings are included to support commands like "Lösche erstes Wort", "Lösche fünftes Wort am Ende", "er setze satz durch vinyl". Additionally, preposition, conjunction and punctuation mappings are also included. In order to support other language pairs, a new synonyms.json file needs to be provided with the source-target mappings. Also note how this file can be easily used to fix transcription errors: in German, we frequently received "er setze" instead of "ersetze" from Watson, but supporting this is as simple as adding it to the list of German words for the "replace" operation.

## Notes regarding mid-air gesture functionality <a name="mid-air-gesture"></a>

Leap Motion Controller enables you to use mid-air gestures with the minimum requirements. The following steps will guide you to install and use it.

The following instructions apply to Windows, but it should work similarly for other operating systems.
1. Download Leap Motion Controller SDK from: https://developer.leapmotion.com/releases/leap-motion-orion-321
2. Install with administrative permissions
3. Connect your Leap Motion Controller to your PC via USB port version 2.0 or 3.0 
4. Run Leap Motion SDK and navigate to General tap, then tick the option **Allow Web Apps**
![Enable Webapps](/assets/imgs/enableWebApps.png
)
5. Make sure that the Leap Motion Controller is actively tracking. There are two ways to do this:
    *  Right click on the SDK icon in your taskbar and click "Resume Tracking". If already activated the icon is displayed green
    ![Resume Tracking](/assets/imgs/midairGesturesResume.png)
    *  You can notice a red color led is on, on top Leap Motion Controller
6. Open the MMPE project and activate mid-air gestures in the navigation bar
    ![Activate Gestures](/assets/imgs/activateMidairGesture.png)
7. Set your sensitivty preferences in the right-hand side panel after activating mid-air gestures
    ![Gesture Sensitivity](/assets/imgs/midairGestureSensitivity.png)

## Notes on deployment of the application on the remote server <a name="deployment"></a>
For the client side code:
1) Build the frontend in production mode by executing the command: `ng build --prod --base-href=/websites/mmpe/ --aot=false --build-optimizer=false`. Naturally change the base-href to whereever you want to host it on your machine.
2) Copy everything within the output folder (dist/mmpe-frontend/ by default) to a folder on the server.
3) Install nginx using the command: `sudo apt-get install nginx` (Of course you can also use apache or another webserver)
4) Configure the server to redirect incoming requests to the created index.html by modifying the nginx config file.
   

For the deployment of the server side code, we use a dockerfile that has the following:
1) An image with nodejs installed on it
2) The server side code is added into the image and all its dependencies are installed.
3) Port 3000 is exposed so that we can access it from our host machine.
4) If all these requirements are met, we can run npm start in the container.
To connect and run multiple containers with docker, we use Docker Compose. The `docker-compose.yml` file is a simple configuration file telling docker compose which continers to build. The command `docker-compose up` will build the images if not already built, and run them in the foreground (you see the output). If everything looks fine, run it in the background (as a deamon instead) by saying `docker-compose up -d`. Now, local requests from the server should already work (e.g. using curl).
5) Finally, make the node.js server accessible form the outside. For this, modify the nginx config file to include: 
        `location /server/ { proxy_pass http://127.0.0.1:3000;`
        `rewrite ^/server/?(.*)$ /$1 break;`
        `proxy_set_header Host $host;`
        `proxy_set_header X-Real-IP $remote_addr;`
        `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;}` so that nginx forwards the http requests for nodejs server to port 3000 of the host system, when asking for `<hostname>/server`