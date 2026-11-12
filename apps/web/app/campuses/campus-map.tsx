"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import type { Campus } from "./campus-explorer";
import "leaflet/dist/leaflet.css";
export default function CampusMap({campuses,selected,onSelect}:{campuses:Campus[];selected:number|null;onSelect:(id:number)=>void}) {
  const container=useRef<HTMLDivElement>(null);
  const map=useRef<LeafletMap|null>(null);
  const markers=useRef<Map<number,CircleMarker>>(new Map());
  const [error,setError]=useState("");
  const selection=useRef(selected);
  useEffect(()=>{
    let canceled=false;const node=container.current;const currentMarkers=markers.current;setError("");
    async function draw(){
      try {
        const L=await import("leaflet"); if(canceled || !node)return;
        const instance=L.map(node,{scrollWheelZoom:false}).setView([38,-97],4);map.current=instance;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on("tileerror",()=>{if(!canceled)setError("Some map tiles could not load. Campus markers and the school list remain available.");}).addTo(instance);
        for(const school of campuses){
          const marker=L.circleMarker([school.lat,school.lng],{radius:7,color:"#fff",weight:2,fillColor:"#005587",fillOpacity:1}).addTo(instance);
          const popup=document.createElement("div");const title=document.createElement("strong");title.textContent=school.name;const place=document.createElement("p");place.textContent=`${school.city}, ${school.state}`;const link=document.createElement("a");link.href=`/schools/${school.school_id}`;link.textContent="View school profile →";popup.append(title,place,link);marker.bindPopup(popup);marker.on("click",()=>onSelect(school.school_id));currentMarkers.set(school.school_id,marker);
        }
        if(campuses.length)instance.fitBounds(L.latLngBounds(campuses.map(s=>[s.lat,s.lng] as [number,number])),{padding:[35,35],maxZoom:10});
        const focused=selection.current===null ? null:currentMarkers.get(selection.current);
        if(focused){instance.setView(focused.getLatLng(),8);focused.openPopup();}
      }catch{if(!canceled)setError("The map could not load. You can still explore every college in the list.");}
    }draw();return()=>{canceled=true;map.current?.remove();map.current=null;currentMarkers.clear();};
  },[campuses,onSelect]);
  useEffect(()=>{
    selection.current=selected;
    const marker=selected===null ? null:markers.current.get(selected);
    if(marker && map.current){map.current.setView(marker.getLatLng(),Math.max(map.current.getZoom(),8));marker.openPopup();}
  },[selected]);
  return <><div ref={container} className="campus-leaflet-map" aria-label="Interactive college map"/>{error && <p role="status" className="campus-map-error">{error}</p>}</>;
}
