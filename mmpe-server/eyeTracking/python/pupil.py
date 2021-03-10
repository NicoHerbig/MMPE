"""
Receive data from Pupil server broadcast over TCP
test script to see what the stream looks like
and for debugging
"""
import zmq
import websocket
import sys
import time
# we need a serializer
import msgpack
import cv2
import numpy as np

from utils import send_data, calculate_and_send_fixation

global pupil0, pupil1
pupil0 = None
pupil1 = None

def transformGazeToEvent(gaze):
    # transforms a pupil gaze.3d object to a tobii style gaze
    norm_pos =  gaze[b'norm_pos']
    x = norm_pos[0]
    y = 1 - norm_pos[1]  # different coord system than Tobii
    
    # transform to same schema as Tobii Tracker, just fake having diameter and different data for left and right
    gaze_left = {'x': x, 'y': y, 'valid': 1.0}
    pupil_left = {'diam': pupil1, 'valid': 1.0}
    left = {'gaze': gaze_left, 'pupil': pupil_left}
    
    gaze_right = {'x': x, 'y': y, 'valid': 1.0}
    pupil_right = {'diam': pupil0, 'valid': 1.0}
    right = {'gaze': gaze_right, 'pupil': pupil_right}

    gaze = {'gaze': {'ts': time.time(), 'left': left, 'right': right}}
    return gaze


ctx = zmq.Context()
# ws = websocket.WebSocket()
# ws.connect("ws://" + serverAddr + ":3000")

#open a req port to talk to pupil
ip = '127.0.0.1' # remote ip or localhost
port = "50020" # same as in the pupil remote gui

# open a sub port to listen to pupil
pupil_remote = ctx.socket(zmq.REQ)
# pupil_remote.connect('tcp://127.0.0.1:50020')
# sub = context.socket(zmq.SUB)
# sub.connect("tcp://%s:%s" %(addr, sub_port))
pupil_remote.connect(f'tcp://{ip}:{port}')
# sub.setsockopt(zmq.SUBSCRIBE, b'')

# specify the name of the surface you want to use
surface_name = 'display'

# print("start receiving...")


# Request 'SUB_PORT' for reading data
pupil_remote.send_string('SUB_PORT')
sub_port = pupil_remote.recv_string()

# Request 'PUB_PORT' for writing data
pupil_remote.send_string('PUB_PORT')
pub_port = pupil_remote.recv_string()

# Assumes `sub_port` to be set to the current subscription port
subscriber = ctx.socket(zmq.SUB)
subscriber.connect(f'tcp://{ip}:{sub_port}')
subscriber.subscribe('surface')  # receive all gaze messages
subscriber.subscribe('gaze')  # receive all gaze messages
subscriber.subscribe('pupil')  # receive all diameter messages

while True:
    topic, payload = subscriber.recv_multipart()
    message = msgpack.loads(payload)
    # print(f"{topic}: {message}")

    topic_str = topic.decode("utf-8")
    # TODO use topic_str ending to determine the eye it belongs to
    # then memorize last right and left eye, whenever both are set, agerage them (using function from Tobii script)
    # create and send same event

    if topic_str.startswith('pupil'):
        diameter = message[b'diameter']
        id = message[b'id']
        if id == 0:
            pupil0 = diameter
        elif id == 1:
            pupil1 = diameter

    if topic_str.startswith('blink'):
        # TODO check if we want to subscribe and implement
        diameter = array[1].split(":")[1]
        if diameter == "0.0":
           blink = True
        if blink and diameter != "0.0":
                blink = False
                _data = {}
                _data['event'] = 'onBlink'
                _data['id'] = 12
                event = json.dumps(_data)
                print(event)

    if topic_str.startswith('gaze'):
        pass
        # gaze = transformGazeToEvent(message)
        # send_data(gaze)

        # Calculate fixations and send if a fixation was detected
        # calculate_and_send_fixation(gaze['gaze'])

    if topic_str.startswith('surface'):

        # in case I want to transform the 3d point myself, save it and use the code below
        # transformMatrix = message[b'img_to_surf_trans']
        # transformMatrix_np = np.array(transformMatrix)
        # points_to_be_transformed = np.array([[[0, 0.5, 0.5]]], dtype=np.float32)
        # output_point = cv2.transform(points_to_be_transformed, transformMatrix_np)
        # print(output_point)

        # directly use gaze_on_surfaces
        gazes_on_surfaces = message[b'gaze_on_surfaces']
        if len(gazes_on_surfaces) > 0:
            latest_gaze = gazes_on_surfaces[0]
            gaze = transformGazeToEvent(latest_gaze)
            send_data(gaze)

            # Calculate fixations and send if a fixation was detected
            calculate_and_send_fixation(gaze['gaze'])
