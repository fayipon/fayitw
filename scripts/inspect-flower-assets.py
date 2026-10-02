import io,json,struct
from pathlib import Path
import numpy as np
from PIL import Image

def read_model(name):
    raw=Path('assets/models/clay-farm/'+name+'.glb').read_bytes()
    length=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+length]); binary=raw[28+length:]
    def accessor(index):
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
        dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']]
        columns={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        return np.frombuffer(binary,dtype=dtype,count=a['count']*columns,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,columns)
    primitive=doc['meshes'][0]['primitives'][0]
    attrs={k:accessor(v) for k,v in primitive['attributes'].items()}
    tex=doc['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']
    view=doc['bufferViews'][doc['images'][doc['textures'][tex]['source']]['bufferView']]
    image=Image.open(io.BytesIO(binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])).convert('RGB')
    return doc,binary,attrs,accessor(primitive['indices']).reshape(-1,3),image

if __name__=='__main__':
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    for name in ['cottage']:
        doc,binary,attrs,tri,image=read_model(name)
        p=attrs['POSITION'];uv=attrs['TEXCOORD_0'];pixels=np.asarray(image)
        colors=pixels[np.clip((uv[:,1]*image.height).astype(int),0,image.height-1),np.clip((uv[:,0]*image.width).astype(int),0,image.width-1)]/255
        mask=(p[:,1]<-.60)&(p[:,2]>.33)&(p[:,0]<-.43)
        p=p[mask];colors=colors[mask]
        fig,axes=plt.subplots(1,2,figsize=(14,7))
        for ax,(a,b,depth) in zip(axes,[(0,1,2),(0,2,1)]):
            order=np.argsort(p[:,depth]);ax.scatter(p[order,a],p[order,b],c=colors[order],s=1);ax.set_aspect('equal');ax.grid();ax.set_xlabel('xyz'[a]);ax.set_ylabel('xyz'[b])
        fig.savefig(str(Path.home()/'AppData/Local/Temp'/('inspect-'+name+'.png')),dpi=130);plt.close(fig)
        print(name,p.shape,tri.shape)
