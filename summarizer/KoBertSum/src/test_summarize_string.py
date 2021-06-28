#from src.prepro.data_builder import format_to_bert
import os
import sys

pwd = sys.path[0]; kobert_path = pwd.split("ai-moderator")[0]+"ai-moderator/summarizer/KoBertSum"
sys.path.append(kobert_path+"/src")
print("SYSPATH", sys.path)


from prepro import data_builder 
from make_data import preprocessing
from models.model_builder import ExtSummarizer
from models import data_loader
from models.trainer_ext import Trainer

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
parser.add_argument("-source", default='')
parser.add_argument("-sourcefile", default='')

########################################################

parser.add_argument("-test_from", default=kobert_path+'/ext/models/1209_1236/model_step_7000.pt', type=str)
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
parser.add_argument("-temp_dir", default=kobert_path+'/temp')
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
# READ STRING AND SUMMARIZE
##########################################

class KOBERT_SUMMARIZER:
    
    def __init__(self):

        os.environ["CUDA_VISIBLE_DEVICES"] = args.visible_gpus
        self.gpu_ranks = [int(i) for i in range(len(args.visible_gpus.split(',')))]; n_gpu = len(self.gpu_ranks)
        self.device = "cpu" if args.visible_gpus == '-1' else "cuda"
        self.device_id = 0 if self.device == "cuda" else -1

        self.step = 100000
        optim = None
        args.result_path='./mytest'

        test_ckpt = kobert_path+'/ext/models/1209_1236/model_step_7000.pt'

        checkpoint = torch.load(test_ckpt, map_location=lambda storage, loc: storage)
        opt = vars(checkpoint['opt'])
        model_flags = ['hidden_size', 'ff_size', 'heads', 'inter_layers', 'encoder', 'ff_actv', 'use_interval', 'rnn_size']
        for k in opt.keys():
            if (k in model_flags):
                setattr(args, k, opt[k])


        model = ExtSummarizer(args, self.device, checkpoint)
        model.eval()
        self.trainer = Trainer(args, model, optim, args.accum_count, n_gpu, self.gpu_ranks, report_manager=None)

        
    ### PREPROCESSING
    def encode(self, text):
        # VARIABLES
        src = [preprocessing(l+".").split() for l in text.strip().split(".") ] 
        tgt = []

        sent_labels = [-1, -1, -1]
        is_test = True

        ## PROCESSING
        bert = data_builder.BertData(args)
        b_data = bert.preprocess(src, tgt, sent_labels, is_test=is_test)
        assert b_data != None, "BERT preprocess should be not None"

        src_subtoken_idxs, sent_labels, tgt_subtoken_idxs, segments_ids, cls_ids, src_txt, tgt_txt = b_data
        b_data_dict = {"src": src_subtoken_idxs, "tgt": tgt_subtoken_idxs,
                            "src_sent_labels": sent_labels, "segs": segments_ids, "clss": cls_ids,
                            "src_txt": src_txt, "tgt_txt": tgt_txt}            
        data = [[b_data_dict[k] for k in ['src', 'tgt', 'segs', 'clss', 'src_sent_labels', 'src_txt', 'tgt_txt']]]

        ## DATA INTO BATCH FOR ITERATION
        batch = data_loader.Batch(data, device=self.device, is_test=True) 
        return batch

    def generate(self, batch, num_sentences=3):
        return self.trainer.generate([batch], self.step, num_sentences)

    def test(self ,batch):
        self.trainer.test([batch], self.step)

