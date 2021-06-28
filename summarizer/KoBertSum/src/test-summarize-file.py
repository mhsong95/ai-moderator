#from src.prepro.data_builder import format_to_bert
from prepro import data_builder 
from make_data import preprocessing
from models.model_builder import ExtSummarizer
from models import data_loader
from models.trainer_ext import Trainer

import os
import argparse
import json
import pandas as pd
import gc
import torch
import numpy as np

def str2bool(v):
    if isinstance(v, bool):
        return v
    if v.lower() in ('yes', 'true', 't', 'y', '1'):
        return True
    elif v.lower() in ('no', 'false', 'f', 'n', '0'):
        return False
    else:
        raise argparse.ArgumentTypeError('Boolean value expected.')

##############################################################################
parser = argparse.ArgumentParser()
parser.add_argument("-sourcefile", default='')
parser.add_argument("-test_from", default='./ext/models/1209_1236/model_step_7000.pt', type=str)

parser.add_argument('-dataset', default='test')
parser.add_argument('-save_path', default='/mnt/1tb/leehayeon/KoBertSum/test-result/')
parser.add_argument('-n_cpus', default=2, type=int)

parser.add_argument('-task', default='ext')

parser.add_argument("-lower", type=str2bool, nargs='?',const=True,default=True)
parser.add_argument("-use_bert_basic_tokenizer", type=str2bool, nargs='?',const=True,default=False)
parser.add_argument("-jsonfile", default=None)
parser.add_argument("-mode", default='test', type=str)

########################################################

parser.add_argument("-pretrained_model", default='bert', type=str)

parser.add_argument("-select_mode", default='greedy', type=str)
parser.add_argument("-map_path", default='../../data/')
parser.add_argument("-raw_path", default='../../line_data')

parser.add_argument("-shard_size", default=2000, type=int)
parser.add_argument('-min_src_nsents', default=1, type=int)    # 3
parser.add_argument('-max_src_nsents', default=120, type=int)    # 100
parser.add_argument('-min_src_ntokens_per_sent', default=1, type=int)    # 5
parser.add_argument('-max_src_ntokens_per_sent', default=300, type=int)    # 200
parser.add_argument('-min_tgt_ntokens', default=1, type=int)    # 5
parser.add_argument('-max_tgt_ntokens', default=500, type=int)    # 500

########
parser.add_argument("-large", type=str2bool, nargs='?',const=True,default=False)
parser.add_argument("-temp_dir", default='/mnt/1tb/leehayeon/KoBertSum/temp')
parser.add_argument("-finetune_bert", type=str2bool, nargs='?', const=True, default=True)
parser.add_argument("-ext_ff_size", default=2048, type=int)

parser.add_argument("-ext_dropout", default=0.2, type=float)
parser.add_argument("-ext_layers", default=2, type=int)
parser.add_argument("-ext_hidden_size", default=768, type=int)
parser.add_argument("-ext_heads", default=8, type=int)
parser.add_argument("-max_pos", default=512, type=int)

parser.add_argument("-test_batch_size", default=200, type=int)
parser.add_argument("-accum_count", default=1, type=int)
parser.add_argument("-max_tgt_len", default=140, type=int)

parser.add_argument("-block_trigram", type=str2bool, nargs='?', const=True, default=True)

parser.add_argument("-save_checkpoint_steps", default=5, type=int)
parser.add_argument("-recall_eval", type=str2bool, nargs='?',const=True,default=False)

########
parser.add_argument('-log_file', default='../../logs/cnndm.log')
parser.add_argument('-visible_gpus', default='-1', type=str)

args = parser.parse_args()
###############################################################################


##########################################
# READ TXT FILE AND WRITE JSON FILE
##########################################

with open(args.sourcefile, "r") as f:
    lines = f.readlines()

json_list = []
for line in lines:
    src = [preprocessing(l+".").split() for l in line.strip().split(".") ] 
    json_list.append({'src':src , 'tgt': []})
json_string = json.dumps(json_list, indent=4, ensure_ascii=False)

args.jsonfile = args.jsonfile if args.jsonfile else args.sourcefile.replace(".txt", ".json")
with open(args.jsonfile, "w") as f:
    f.write(json_string)
print("WRITE "+args.jsonfile)

############################################
# CONVERT DF TO bert.pt
############################################

bert = data_builder.BertData(args)
datasets= []; is_test = True

for d in json_list:
    source, tgt = d['src'], d['tgt']
    sent_labels = data_builder.full_selection(source[:args.max_src_nsents], tgt, 3)

    if args.lower:
        source = [' '.join(s).lower().split() for s in source]
        tgt = [' '.join(s).lower().split() for s in tgt]

    b_data = bert.preprocess(source, tgt, sent_labels, use_bert_basic_tokenizer=args.use_bert_basic_tokenizer,
                                 is_test=is_test)

    if (b_data is None):
        continue

    src_subtoken_idxs, sent_labels, tgt_subtoken_idxs, segments_ids, cls_ids, src_txt, tgt_txt = b_data
    b_data_dict = {"src": src_subtoken_idxs, "tgt": tgt_subtoken_idxs,
                       "src_sent_labels": sent_labels, "segs": segments_ids, 'clss': cls_ids,
                       'src_txt': src_txt, "tgt_txt": tgt_txt}                     
    datasets.append(b_data_dict)

# print("DATASETS", np.array(datasets).shape)
# print(datasets[2]); exit()



bert_pt_file = args.jsonfile.replace("json", "bert.pt")
torch.save(datasets, bert_pt_file); print("WRITE "+bert_pt_file)
datasets= []; gc.collect()


############################################
# 
############################################
def load_dataset(args, corpus_type, shuffle, bert_pt_file=bert_pt_file):
    def _lazy_dataset_loader(pt_file, corpus_type):
        dataset = torch.load(pt_file)
        return dataset

    pt = bert_pt_file 
    yield _lazy_dataset_loader(pt, corpus_type)

def _tally_parameters(model):
    n_params = sum([p.nelement() for p in model.parameters()])
    return n_params


# GPU SETTING
args.gpu_ranks = [int(i) for i in range(len(args.visible_gpus.split(',')))]
os.environ["CUDA_VISIBLE_DEVICES"] = args.visible_gpus
device = "cpu" if args.visible_gpus == '-1' else "cuda"
device_id = 0 if device == "cuda" else -1


#train_extractive.py test_ext(...)
model_flags = ['hidden_size', 'ff_size', 'heads', 'inter_layers', 'encoder', 'ff_actv', 'use_interval', 'rnn_size']

checkpoint = torch.load(args.test_from, map_location=lambda storage, loc: storage)
opt = vars(checkpoint['opt'])
for k in opt.keys():
    if (k in model_flags):
        setattr(args, k, opt[k])




model = ExtSummarizer(args, device, checkpoint)
model.eval()
 
dataset = load_dataset(args, 'test', shuffle=False)
test_iter = data_loader.Dataloader(args, dataset,
                                    args.test_batch_size, device,
                                    shuffle=False, is_test=True)



# print("LINES", np.array(lines).shape)
# print("JSON_LIST", np.array(json_list).shape)


#trainer = build_trainer(args, device_id, model, None)
optim = None; n_gpu = len(args.gpu_ranks)
step = 100000; args.result_path='./mytest'
trainer = Trainer(args, model, optim, args.accum_count, n_gpu, args.gpu_ranks, report_manager=None)
if (model):
    n_params = _tally_parameters(model)
trainer.test(test_iter, step)


