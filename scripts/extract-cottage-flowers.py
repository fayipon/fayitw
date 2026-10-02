"""Extract the supplied cottage's front flower bed, retaining its UVs and normals.

Run from the repository root. Requires numpy and Pillow.
The bounds isolate the left front planting without the adjacent steps or wall.
"""
import importlib.util,io,json,struct
from pathlib import Path
import numpy as np

spec=importlib.util.spec_from_file_location('flower_assets',Path(__file__).with_name('inspect-flower-assets.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
doc,binary,attrs,tri,image=module.read_model('cottage')
p=attrs['POSITION']
inside=(p[:,0]<-.47)&(p[:,1]<-.60)&(p[:,2]>.33)
selected=tri[inside[tri].all(axis=1)]
vertices,inverse=np.unique(selected,return_inverse=True)
positions=p[vertices].copy()
positions-=np.array([(positions[:,0].min()+positions[:,0].max())/2,positions[:,1].min(),(positions[:,2].min()+positions[:,2].max())/2])
data=bytearray();views=[];accessors=[]
def append(raw):
    while len(data)%4:data.append(0)
    views.append({'buffer':0,'byteOffset':len(data),'byteLength':len(raw)})
    data.extend(raw);return len(views)-1
def attribute(values,kind,component):
    a={'bufferView':append(values.tobytes()),'componentType':component,'count':len(values),'type':kind}
    if kind=='VEC3':a.update(min=values.min(axis=0).tolist(),max=values.max(axis=0).tolist())
    accessors.append(a);return len(accessors)-1
attributes={}
for name,values in attrs.items():
    values=positions if name=='POSITION' else values[vertices]
    attributes[name]=attribute(values.astype('<f4'),'VEC'+str(values.shape[1]),5126)
indices=attribute(inverse.reshape(-1).astype('<u4'),'SCALAR',5125)
image.thumbnail((2048,2048));encoded=io.BytesIO();image.save(encoded,format='PNG')
image_view=append(encoded.getvalue())
out={'asset':{'version':'2.0','generator':'Cottage front flower extraction'},'scene':0,'scenes':[{'nodes':[0]}],
 'nodes':[{'mesh':0,'name':'Original cottage front flowers'}],
 'meshes':[{'primitives':[{'attributes':attributes,'indices':indices,'material':0}]}],
 'materials':[{'name':'Original clay flowers','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':1},'doubleSided':True}],
 'textures':[{'source':0}],'images':[{'bufferView':image_view,'mimeType':'image/png'}],
 'buffers':[{'byteLength':len(data)}],'bufferViews':views,'accessors':accessors}
header=json.dumps(out,separators=(',',':')).encode();header+=b' '*((-len(header))%4)
data+=b'\0'*((-len(data))%4)
result=struct.pack('<III',0x46546c67,2,28+len(header)+len(data))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(data),0x004e4942)+data
Path('assets/models/clay-farm/cottage-flowers.glb').write_bytes(result)
print(f'Extracted {len(selected)} triangles, {len(result)} bytes')
