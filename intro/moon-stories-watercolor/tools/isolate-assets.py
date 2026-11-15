from pathlib import Path
import cv2,numpy as np
from PIL import Image,ImageFilter
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/images'

def isolate(name,source,box,outline,seeds=()):
 image=np.array(Image.open(SOURCE/source).convert('RGB'))
 x,y,w,h=box;rgb=image[y:y+h,x:x+w].copy()
 poly=np.array(outline,np.int32)
 shape=np.zeros((h,w),np.uint8);cv2.fillPoly(shape,[poly],255)
 # A narrow uncertainty band lets GrabCut follow pigment instead of a polygon edge.
 inner=cv2.erode(shape,np.ones((5,5),np.uint8));outer=cv2.dilate(shape,np.ones((3,3),np.uint8))
 mask=np.full((h,w),cv2.GC_BGD,np.uint8);mask[outer>0]=cv2.GC_PR_BGD;mask[shape>0]=cv2.GC_PR_FGD;mask[inner>0]=cv2.GC_FGD
 if source=='chucuoi.png':
  paper=((rgb[:,:,0]>230)&(rgb[:,:,1]>210)&(rgb[:,:,2]>185)).astype(np.uint8)
  _,labels=cv2.connectedComponents(paper)
  edge_labels=set(np.concatenate([labels[0,:],labels[-1,:],labels[:,0],labels[:,-1]]));edge_labels.discard(0)
  background=np.isin(labels,list(edge_labels))
  mask[background]=cv2.GC_BGD
 for sx,sy,rad in seeds:cv2.circle(mask,(sx,sy),rad,cv2.GC_FGD,-1)
 cv2.grabCut(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),mask,None,np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),4,cv2.GC_INIT_WITH_MASK)
 alpha=np.where((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD),255,0).astype(np.uint8)
 alpha=Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(.55))
 rgba=Image.fromarray(rgb).convert('RGBA');rgba.putalpha(alpha)
 bounds=rgba.getbbox();rgba=rgba.crop(bounds)
 target=ROOT/'assets'/name;target.parent.mkdir(parents=True,exist_ok=True);rgba.save(target,lossless=True)
 return {'file':str(target.relative_to(ROOT)),'source':source,'crop':box,'dimensions':rgba.size,'alpha_extrema':rgba.getchannel('A').getextrema()}

reports=[]
# Source sheet front pose. Coordinates trace the supplied painted silhouette.
reports.append(isolate('characters/cuoi/cuoi_stand.webp','chucuoi.png',(0,0,463,895),[(213,30),(247,33),(261,45),(284,46),(311,70),(321,113),(317,148),(295,180),(311,200),(335,217),(350,253),(361,295),(378,354),(393,392),(413,439),(446,461),(451,489),(431,506),(428,560),(424,615),(432,657),(448,695),(457,735),(449,795),(405,797),(375,787),(371,755),(389,712),(388,689),(365,662),(365,600),(350,552),(334,523),(324,568),(331,608),(323,649),(314,682),(314,734),(334,780),(375,800),(375,817),(350,829),(306,827),(281,810),(275,773),(271,738),(257,700),(219,701),(184,682),(176,731),(166,779),(157,817),(127,845),(84,857),(63,847),(62,823),(81,796),(106,765),(110,730),(107,693),(91,662),(92,611),(108,563),(123,510),(132,478),(109,447),(81,429),(62,397),(43,367),(26,335),(23,285),(34,254),(63,231),(78,202),(110,211),(139,222),(165,213),(166,186),(136,177),(111,202),(89,197),(101,175),(76,171),(90,154),(75,147),(98,131),(110,105),(133,87),(162,72),(173,47),(191,48)]))
# Rabbit's complete sitting pose from the lower centre of its sheet.
reports.append(isolate('characters/rabbit/rabbit_idle.webp','thongoc.png',(830,430,550,490),[(150,105),(169,92),(200,82),(205,64),(226,46),(259,31),(300,19),(353,5),(359,10),(351,26),(331,43),(306,59),(277,72),(255,81),(296,86),(337,78),(380,71),(421,69),(464,76),(494,86),(514,98),(512,108),(497,121),(472,134),(445,145),(418,152),(390,154),(362,149),(336,140),(310,125),(288,113),(296,131),(305,151),(307,178),(304,199),(298,218),(290,231),(270,239),(249,243),(249,268),(252,293),(259,315),(270,330),(277,349),(280,367),(296,347),(315,336),(326,336),(333,343),(331,357),(321,380),(304,400),(283,420),(277,435),(263,443),(245,444),(228,437),(217,429),(216,438),(203,447),(178,448),(151,447),(122,444),(109,438),(104,426),(88,416),(73,402),(52,405),(33,401),(21,389),(17,370),(20,351),(19,335),(28,315),(42,304),(63,299),(81,304),(90,313),(111,283),(133,254),(149,237),(133,228),(119,216),(111,203),(109,191),(112,177),(123,164),(133,151),(143,134)]))
(ROOT/'verification/cutout-attempt.json').write_text(__import__('json').dumps(reports,indent=2),encoding='utf-8')
print(reports)
