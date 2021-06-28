python3 -m pip install konlpy
python3 -m pip install -r requirements.txt
python3 -m pip install Cython
python3 -m pip install -r requirements_prepro.txt

# INSTALL MECAB-KO
python3 -m pip install -v python-mecab-ko
curl -s https://raw.githubusercontent.com/konlpy/konlpy/master/scripts/mecab.sh


# DOWNLOAD MODEL CKPT
#https://drive.google.com/file/d/1rv7BLj82S_ya18KIygHbviio31PEtKbm/view?usp=sharing
curl -c ./cookie -s -L "https://drive.google.com/uc?export=download&id=1rv7BLj82S_ya18KIygHbviio31PEtKbm" > /dev/null
curl -Lb ./cookie "https://drive.google.com/uc?export=download&confirm=`awk '/download/ {print $NF}' ./cookie`&id=1rv7BLj82S_ya18KIygHbviio31PEtKbm" -o model_step_7000.pt.tar.gz

tar -zxvf  model_step_7000.pt.tar.gz -C ./ext/models/1209_1236/model_step_7000.pt
rm model_step_7000.pt.tar.gz 