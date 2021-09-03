from fastapi import FastAPI, Request
from typing import Optional
from pydantic import BaseModel
import editdistance
from cluster import KMeansClustering
import ctranslate2
import sentencepiece as spm
from statistics import mean
import numpy as np
from fastapi.middleware.cors import CORSMiddleware
from wer import wer


def wer_score(hyp, ref, print_matrix=True):
    N = len(hyp)
    M = len(ref)
    L = np.zeros((N,M))
    change_count = None
    for i in range(0, N):
        for j in range(0, M):
            if min(i,j) == 0:
                L[i,j] = max(i,j)
            else:
                deletion = L[i-1,j] + 1
                insertion = L[i,j-1] + 1
                sub = 1 if hyp[i] != ref[j] else 0
                substitution = L[i-1,j-1] + sub
                change_count = (insertion, deletion, substitution)
                L[i,j] = min(deletion, min(insertion, substitution))
                #print("{} - {}: del {} ins {} sub {} s {}".format(hyp[i], ref[j], deletion, insertion, substitution, sub))
    if print_matrix:
        print("WER matrix ({}x{}): ".format(N, M))
        print(L)
    return int(L[N-1, M-1]), change_count


class TranslationInput(BaseModel):
    source: str
    num_hyp: Optional[int] = 10
    target_prefix: Optional[str] = None
    reference: Optional[str] = None

def tokenize(data):
    return sp.encode(data, out_type = str )

def detokenize(data):
    return sp.decode(data)

translator = ctranslate2.Translator(".")
sp = spm.SentencePieceProcessor(model_file = '../sentencepiece.model')


app = FastAPI()

app.add_middleware(
           CORSMiddleware,
           allow_origins="http://localhost:3000",
           allow_methods=["POST"],
           allow_headers=["*"]
)

@app.post('/api/alternatives')
def generate_translate(input: TranslationInput):
    print("we are in generate_translation function--------")
    if input.target_prefix is not None:
        print("target_prefix:-", input.target_prefix)
        results = translator.translate_batch([tokenize(input.source)],
                target_prefix=[tokenize(input.target_prefix)], num_hypotheses=input.num_hyp,
                return_alternatives=True, return_scores=True)
        api_results = dict(minor_changes=[], major_changes=[])
        for r in results[0]:
            translation = detokenize(r['tokens'])
            print("translation", translation)
            score = r['score']
            ter = wer(input.reference, translation)
            if ter['wer_result'] < .2:
                api_results['minor_changes'].append(dict(translation=translation, score=r['score'], ter=ter['wer_result']))
            else:
                api_results['major_changes'].append(dict(translation=translation, score=r['score'], ter=ter['wer_result']))      
    else:
        results = translator.translate_batch([tokenize(input.source)], num_hypotheses=input.num_hyp, return_alternatives=True)
        api_results = [{'translation': detokenize(r['tokens']), 'score': r['score']} for r in results[0]]
    return api_results

