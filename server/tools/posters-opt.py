#!/usr/bin/env python3
"""Convert shorts/posters/NN-slug.png into optimized JPG + WebP (<300KB, 720px wide)."""
import glob,os
from PIL import Image
R=os.path.join(os.path.dirname(__file__),'..','..','shorts','posters')
for p in sorted(glob.glob(os.path.join(R,'[0-9][0-9]-*.png'))):
  b=p[:-4]
  if os.path.exists(b+'.jpg') and os.path.getmtime(b+'.jpg')>=os.path.getmtime(p): continue
  im=Image.open(p).convert('RGB');w=720
  if im.width>w: im=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS)
  for ext,fmt in(('.jpg','JPEG'),('.webp','WEBP')):
    q=85
    while True:
      im.save(b+ext,fmt,quality=q,optimize=True) if fmt=='JPEG' else im.save(b+ext,fmt,quality=q,method=6)
      if os.path.getsize(b+ext)<300_000 or q<=45: break
      q-=8
  print('ok',os.path.basename(b),os.path.getsize(b+'.jpg'))
