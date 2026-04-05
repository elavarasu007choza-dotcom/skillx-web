import { useEffect,useState } from "react";
import { auth,db } from "../firebase";
import { collection,query,where,onSnapshot } from "firebase/firestore";

export default function Notifications(){

const [list,setList] = useState([]);

useEffect(()=>{

const q = query(
collection(db,"notifications"),
where("userId","==",auth.currentUser.uid)
);

const unsub = onSnapshot(q,(snap)=>{
setList(snap.docs.map(d=>({id:d.id,...d.data()})));
});

return ()=>unsub();

},[]);

return(

<div style={{padding:"20px"}}>

<h2>Notifications</h2>

{list.map(n=>(
<div key={n.id} style={{marginBottom:"10px"}}>
{n.message}
</div>
))}

</div>

);

}