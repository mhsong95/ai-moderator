import os
import argparse

######################################################################################
#####################   PARSE LOGS
######################################################################################

################### ARGUMENT
parser = argparse.ArgumentParser()
parser.add_argument("username", type=str)
parser.add_argument("roomname", type=str)
args = parser.parse_args()

username = args.username 
roomname = args.roomname 
############################

# READ LOGS
with os.popen("ls ./media-server/logs/{}_{}*".format(roomname, username)) as stream:
    logfile = stream.read().split()[-1]

with open(logfile, "r") as f:
    lines = f.readlines()

# PARSE LINES
userdata = {}; mintime = None
for line in lines[5:]:
    time = int(line.split(")")[0].replace("(", "")); mintime = time if mintime==None else mintime; maxtime = time

    params = line.split(")")[-1].strip()
    action = params.split("/")[0]

    if action not in userdata:
        userdata[action]={}
    userdata[action][time] = {arg.split("=")[0]:arg.split("=")[1] for arg in params.split("/")[1:]}


# CHECK
#for key in userdata:
#    print(key, userdata[key])

'''
for key in ["START-EDIT-MESSAGE", "UPDATE-PARAGRAPH-MESSAGEBOX", "FINISH-EDIT-PARAGRAPH", "CANCLE-EDIT-PARAGRAPH"]:
    if key in userdata:
        print(key)
        keys = userdata[key].keys()
        print(keys, [userdata[key][k]['TIMESTAMP'] for k in keys])
'''

######################################################################################
#####################   DRAW GRAPH
######################################################################################
import matplotlib.pyplot as plt 
from numpy import inf

def pair_on_off (data):
    ONs = data[0]; OFFs = data[1]

    ONs = sorted(list(ONs.keys()))
    OFFs = sorted(list(OFFs.keys()))

    if len(ONs) == 0 or len(OFFs) == 0:
        return []

    if OFFs[0] < ONs[0]:
        OFFs.pop(0)


    return [(on, off-on) for on, off in zip(ONs, OFFs)]

def pair_start_finish_or_cancel(start, finish, cancel):
    modify = {start[time]['TIMESTAMP']: {'START': time} for time in start}
    for time in finish:
        modify[finish[time]['TIMESTAMP']]['FINISH'] = time
    for time in cancel:
        modify[cancel[time]['TIMESTAMP']]['CANCEL'] = time

    finish_result = []
    cancel_result = []

    for timestamp in modify:
        if 'FINISH' in modify[timestamp]:
            start = modify[timestamp]['START']
            finish = modify[timestamp]['FINISH']
            finish_result.append((start, finish-start))
        else:
            start = modify[timestamp]['START']
            cancel = modify[timestamp]['CANCEL']
            cancel_result.append((start, cancel-start))

    return finish_result, cancel_result

def find_edit_msg_pair(start_msgs, cancel_pgh, finish_pgh, cancel_smm, finish_smm):

    # START-EDIT-MESSAGE
    #{1628682273386: {'TYPE': 'absum', 'TIMESTAMP': '1628135388083'}, 1628682282081: {'TYPE': 'paragraph', 'TIMESTAMP': '1628135388083'}, 1628682295816: {'TYPE': 'paragraph', 'TIMESTAMP': '1628135356660'}, 1628682300271: {'TYPE': 'absum', 'TIMESTAMP': '1628135356660'}, 1628682318485: {'TYPE': 'paragraph', 'TIMESTAMP': '1628135356660'}}    
    # FINISH-EDIT-PARAGRAPH
    #{1628682286000: {'TYPE': 'paragraph', 'MSG': '성진', 'TIMESTAMP': '1628135388083'}, 1628682298695: {'TYPE': 'paragraph', 'MSG': '영현', 'TIMESTAMP': '1628135356660'}, 1628682321507: {'TYPE': 'paragraph', 'MSG': '영현', 'TIMESTAMP': '1628135356660'}}

    start_pgh= {}; start_smm= {}
    for time in start_msgs:
        if start_msgs[time]['TYPE'] == "paragraph":
            start_pgh[time] = start_msgs[time]
        else:
            start_smm[time] = start_msgs[time]

    finish_pgh_data, cancel_pgh_data = pair_start_finish_or_cancel(start_pgh, finish_pgh, cancel_pgh)
    finish_smm_data, cancel_smm_data = pair_start_finish_or_cancel(start_smm, finish_smm, cancel_smm)

    return finish_pgh_data, cancel_pgh_data, finish_smm_data, cancel_smm_data 

all_actions = ["WINDOW-FOCUS-OFF", "WINDOW-FOCUS-ON", "VIDEO-ON", "VIDEO-OFF", "AUDIO-ON", "AUDIO-OFF",
    "CLICK-INVITE-BUTTON", "CLICK-SEARCH-BUTTON", "CLICK-SHOW-ALL-BUTTON", "CLICK-SCROLL-DOWN-BUTTON",  " ",
    "OPEN-MAP", "OPEN-SUBTASK", "SUBTASK-ANSWER", "SAVE-TEMP-ANSWERS", " ",
    "SCROLL-UP", "SCROLL-DOWN", "SUMMARY-FOR-KEYWORD", " ",
    "UPDATE-PARAGRAPH-MESSAGEBOX", "FINISH-EDIT-PARAGRAPH", "CANCLE-EDIT-PARAGRAPH", 
    "UPDATE-SUMMARY-MESSAGEBOX", "FINISH-EDIT-SUMMARY", "CANCLE-EDIT-SUMMARY", 
    "ADD-KEYWORD", "DELETE-KEYWORD", "SEARCH-WORD",  " ",
    "ADD-FAVORITE", "DELETE-FAVORITE", "SEARCH-FAVORITE"," ", 
    "PIN-BOX", "CLICK-PIN", "UNPIN-BOX", " ",
    "CLICK-HIDE-FULL-TEXT", "CLICK-SEE-FULL-TEXT",  
    "START-EDIT-MESSAGE"]

actions = [ "START-EDIT-MESSAGE",
    "UPDATE-PARAGRAPH-MESSAGEBOX", "FINISH-EDIT-PARAGRAPH", "CANCLE-EDIT-PARAGRAPH",
    "UPDATE-SUMMARY-MESSAGEBOX", "FINISH-EDIT-SUMMARY", "CANCLE-EDIT-SUMMARY",
    "WINDOW-FOCUS-OFF", "WINDOW-FOCUS-ON", "VIDEO-ON", "VIDEO-OFF", "AUDIO-ON", "AUDIO-OFF",]
last_actions = list(filter(lambda x: x not in actions, all_actions)) # Actions not in actions

fig, ax = plt.subplots()

xbar = 300
ybar = 1

for idx, action in enumerate(last_actions):
    if action not in userdata:
        continue
    times = userdata[action].keys()
    actiontime = [(time, xbar) for time in times]

    ax.broken_barh(actiontime, (2*idx, ybar))

# EDIT MESSAGES (PARAGRAPH OR SUMMARY)
start_msgs, finish_pgh, cancel_pgh, finish_smm, cancel_smm = [userdata[x] if x in userdata else {} for x in ["START-EDIT-MESSAGE",  "FINISH-EDIT-PARAGRAPH", "CANCEL-EDIT-PARAGRAPH", "FINISH-EDIT-SUMMARY", "CANCEL-EDIT-SUMMARY"] ]
finish_pgh_data, cancel_pgh_data, finish_smm_data, cancel_smm_data  = find_edit_msg_pair(start_msgs, cancel_pgh, finish_pgh, cancel_smm, finish_smm)

idx+=1; ax.broken_barh([], (2*idx, ybar)) ## EMPTY BAR
idx+=1; ax.broken_barh(finish_pgh_data, (2*idx, ybar))
idx+=1; ax.broken_barh(cancel_pgh_data, (2*idx, ybar))
idx+=1; ax.broken_barh(finish_smm_data, (2*idx, ybar))
idx+=1; ax.broken_barh(cancel_smm_data, (2*idx, ybar))

# ON/OFF - AUDIO/VIDEO/FOCUS
audio = pair_on_off([userdata[x] if x in userdata else {} for x in ['AUDIO-ON', 'AUDIO-OFF']])
video = pair_on_off([userdata[x] if x in userdata else {} for x in ['VIDEO-ON', 'VIDEO-OFF']])
focus = pair_on_off([userdata[x] if x in userdata else {} for x in ['WINDOW-FOCUS-ON', 'WINDOW-FOCUS-OFF']])

idx+=1; ax.broken_barh([], (2*idx, ybar)) ## EMPTY BAR
idx+=1; ax.broken_barh(audio, (2*idx, ybar))
idx+=1; ax.broken_barh(video, (2*idx, ybar))
idx+=1; ax.broken_barh(focus, (2*idx, ybar))

ax.set_yticks([2*i+0.5 for i in range(idx+1)])
labels =[name.split("CLICK-")[-1] for name in last_actions+['FINISH-PGH', 'CANCEL-PGH', 'FINISH-SMM', 'CANCEL-SMM']]
ax.set_yticklabels(last_actions+[" ", 'FINISH-PGH', 'CANCEL-PGH', 'FINISH-SMM', 'CANCEL-SMM', " ", 'AUDIO-ON', 'VIDEO-ON', 'FOCUS-ON'])

ax.set_ylim(-1, 2*(idx+1))
ax.grid(True)
plt.tight_layout()

plt.savefig("./user-log-analysis-{}-{}.png".format(username, roomname))

