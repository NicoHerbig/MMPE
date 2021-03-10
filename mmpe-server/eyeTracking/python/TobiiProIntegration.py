import tobii_research as tr
import time
import json
import math
import numpy as np

from utils import send_data, calculate_and_send_fixation

def gaze_data_callback(gaze_data):
    """
    Callback for Tobii Pro SDK, doing all the work once data arrives
    """
    # Left eye
    gaze_left_eye = gaze_data['left_gaze_point_on_display_area']
    gaze_left = {'x': gaze_left_eye[0], 'y': gaze_left_eye[1], 'valid': gaze_data['left_gaze_point_validity']}
    pupil_left = {'diam': gaze_data['left_pupil_diameter'], 'valid': gaze_data['left_pupil_validity']}
    left = {'gaze': gaze_left, 'pupil': pupil_left}

    # Right eye
    gaze_right_eye = gaze_data['right_gaze_point_on_display_area']
    gaze_right = {'x': gaze_right_eye[0], 'y': gaze_right_eye[1], 'valid': gaze_data['right_gaze_point_validity']}
    pupil_right = {'diam': gaze_data['right_pupil_diameter'], 'valid': gaze_data['right_pupil_validity']}
    right = {'gaze': gaze_right, 'pupil': pupil_right}

    # Both eyes
    gaze = {'gaze': {'ts': time.time(), 'left': left, 'right': right}}

    # Send
    send_data(gaze)

    # Calculate fixations and send if a fixation was detected
    calculate_and_send_fixation(gaze['gaze'])



found_eyetrackers = tr.find_all_eyetrackers()
my_eyetracker = found_eyetrackers[0]
# print("Address: " + my_eyetracker.address)
# print("Model: " + my_eyetracker.model)
# print("Name (It's OK if this is empty): " + my_eyetracker.device_name)
# print("Serial number: " + my_eyetracker.serial_number)


my_eyetracker.subscribe_to(tr.EYETRACKER_GAZE_DATA, gaze_data_callback, as_dictionary=True)
input()  # "Press Enter to exit..."
my_eyetracker.unsubscribe_from(tr.EYETRACKER_GAZE_DATA, gaze_data_callback)
