import React, { Component } from 'react'

    
// let cnvs = document.getElementById('canvas')
// let ctx = cnvs.getContext('2d');

export class Canvas extends Component {

    constructor() {
        super();
        this.state = {
            divergence:null,

        }
    }
    

    componentDidMount() {
        const canvas = this.refs.canvas
        const ctx = canvas.getContext("2d")

        this.draw(canvas,ctx);

    }

    static getDerivedStateFromProps(props,state){
          return{
            divergence:props.divergence.num
          }
    }

    getDivergence(){
        return this.state.divergence*3
    }


    draw=(canvas,ctx)=>{

        let divergence=null;
        let diverPos=5;
        // let divergenceTime=0;
        
        
        let startAnimation=(cnvs,ctx)=>{
            let hexa=createHexagon();
            let a=2;
        
            let startPos=0;
            let startPosTime=0;
        
            let startPos2=0;
            let startPosTime2=0;
            
            let start=0;
            let start1=start+105;
            let start2=start1+105;
            let start3=start2+105;
            let start4=start3+105;
            let start5=start4+105;
            let start6=start5+105;

            setInterval(function(){
        
            if(startPosTime===2){
                startPos++;
                startPosTime=0
                if(startPos===600){
                    startPos=0;
                }
            }

            let dwidth=200;
            let dive=1;
            let diveStart=0+startPos;
            let diveEnd=dwidth+startPos;
        
            let diveV=1;
            let diveVStart=0+startPos;
            let diveVEnd=dwidth+startPos;
                
            
            if(startPosTime2===2){
                startPos2++;
                startPosTime2=0
                if(startPos2===100){
                    startPos2=0;
                    start=getRandomInt(100);
                    start1=start+105;
                    start2=start1+105;
                    start3=start2+105;
                    start4=start3+105;
                    start5=start4+105;
                    start6=start5+105;
                }
            }
        
            for(var i=0;i<hexa.length;i++){
                let extra=0;
                let pos=false;
                if(i>diveStart&&i<(diveStart+(diveEnd-diveStart)/2)){
                    pos=true;
                }
                if(i>(diveStart+(diveEnd-diveStart)/2)&&i<diveEnd){
                    pos=true;
                }
                
                if(i>diveVStart&&i<(diveVStart+(diveVEnd-diveVStart)/2)){
                    pos=true;
                }
                if(i>(diveVStart+(diveVEnd-diveVStart)/2)&&i<diveVEnd){
                    pos=true;
                }

                if(
                    (i>start1&&i<start1+25)||
                    (i>start2&&i<start2+25)||
                    (i>start3&&i<start3+25)||
                    (i>start4&&i<start4+25)||
                    (i>start5&&i<start5+25)
                ){
                    extra=20;
                }


                hexa[i][2]=getVariance(hexa[i][2],a,dive,pos,extra);
                hexa[i][3]=getVariance(hexa[i][3],a,diveV,pos,extra);
                
            }
            
            
            clearCanvas();
            animateHexagon(hexa, diverPos);
            startPosTime++;
            startPosTime2++;
        }, 
        20
        );
        
        }

        
    
    let clearCanvas=()=>{
        ctx.clearRect(-50, -50, 3000, 3000);
    }
    
    let createHexagon=()=>{

        var numberOfSides = 1050,
        size = 310,
        Xcenter = 405,
        Ycenter = 405;
    
        ctx.beginPath();
        ctx.moveTo (Xcenter +  size * Math.cos(0), Ycenter +  size *  Math.sin(0));          
        
        let hex=[];
        for (var i = 1; i <= numberOfSides;i += 1) {
        let csize=size;
        let sides=numberOfSides
        hex.push(
            [Xcenter + csize * Math.cos(i * 2 * Math.PI / sides), 
            Ycenter + csize * Math.sin(i * 2 * Math.PI / sides),
            0,
            0,
            0,
            0
            ])
        ctx.stroke();
        }
        return hex;
    }

    let getVariance=(hexa,a,i,pos,extra)=>{

            let variance=35+extra

            // let variance=0+extra
            if(extra!==0){
            
                return hexa+(getRandomInt(a)*-1)+getRandomInt(a+0.8)
            }

            if(pos===false){
                if(hexa<variance||hexa>-variance){
                    if(hexa>0){
                        return hexa-=1;
                    }else if(hexa<0){
                        return hexa+=1;
                    }            
                }
                return hexa
            }else{
                if(hexa>variance||hexa<0){
                    if(hexa>variance){
                        return hexa-=2;
                    }else if(hexa<-0){
                        return hexa+=2;
                    }            
                }
                return hexa+(getRandomInt(a)*-1)+getRandomInt(a)
            }
            
        }
    
    
    let animateHexagon=(hex,dive)=>{

        let last =divergence;
        divergence=this.getDivergence();
        if(last!==divergence||divergence===null){
            diverPos=0;
            dive=0;
        }else{
            diverPos=diverPos*1.09+0.12
        }

        

        var numberOfSides = 105;
        let sides=numberOfSides;
        let size = 270;
        let Xcenter = 400;
        let Ycenter = 400;
        ctx.beginPath();
        ctx.moveTo (Xcenter +  size * Math.cos(0), Ycenter +  size *  Math.sin(0));          
        // let a=15;
    
        let width=1;
    
        for (var i = 0; i < hex.length;i++) {    
            let csize=size
    
            let checkDive=i%105===divergence;

            if(checkDive&&i>=0&&i<100){
                if(dive>130){
                    dive=130
                }
                csize=size+dive-10
                hex[i][2]=0
                hex[i][3]=0
            
                for(var q=0;q<5;q++){                
                    ctx.moveTo(Xcenter + (csize+hex[i][2]+width-dive) * Math.cos(i * 2 * Math.PI / sides), Ycenter + (csize+hex[i][3]+width-dive+(30-(q*10))) * Math.sin(i * 2 * Math.PI / sides));
                    ctx.lineTo(Xcenter + (csize+hex[i][2]+width) * Math.cos(i * 2 * Math.PI / sides), Ycenter + (csize+hex[i][3]+width) * Math.sin(i * 2 * Math.PI / sides));                    
                }
            }
            if(checkDive&&i>=400&&i<500){
                if(dive>130){
                    dive=130
                }
                csize=size+dive-10
                hex[i][2]=0
                hex[i][3]=0
            }
            if(checkDive&&i>=500&&i<600){
                if(dive>120){
                    dive=120
                }
                csize=size+dive-10
                hex[i][2]=0
                hex[i][3]=0
            }
    
            if(checkDive&&i>=600&&i<700){
                if(dive>120){
                    dive=120
                }
                csize=size+dive-10
                hex[i][2]=0
                hex[i][3]=0
            }
            if(checkDive&&i>=600&&i<700){
                if(dive>120){
                    dive=120
                }
                csize=size+dive-10
                hex[i][2]=0
                hex[i][3]=0
                
            }

            if(checkDive&&i>=100&&i<200){

            }
    
            if(checkDive&&i>=200&&i<300){
                csize=size+(dive/2)+20
            }
    
            if(checkDive&&i>300&&i<400){
                csize=size+(dive/3)
            }
    
            if(checkDive&&i>=900){
                csize=size-(dive/3-10)-getRandomInt(2)
            }
                
            ctx.lineTo (Xcenter + (csize+hex[i][2]+width) * Math.cos(i * 2 * Math.PI / sides), Ycenter + (csize+hex[i][3]+width) * Math.sin(i * 2 * Math.PI / sides));
            width+=0.005
        }
        ctx.strokeStyle = "black";
        ctx.filter = 'blur(3px)';
        ctx.lineWidth = 1.5;
        // ctx.shadowColor = 'black';
        // ctx.shadowOffsetX = 0;
        // ctx.shadowOffsetY = 0;
        // ctx.shadowBlur = 2;
        ctx.stroke();
    }
    
    function getRandomInt(max) {
        return Math.floor(Math.random() * Math.floor(max));
    }
    
    startAnimation();
    }

  

    render() {
        return (
            <div className='canvas'>
                <canvas id='canvas' ref="canvas" width={800} height={800} />
            </div>
        )
    }
}

export default Canvas
