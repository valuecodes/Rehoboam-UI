import React, { Component } from 'react'
import Animation from './animation/animation'
import Divergency from './divergency/divergengy'
import { MainSVG } from './divergency/mainSVG';

export class Reheboam extends Component {

    constructor() {
        super();
        this.state = {
            today:'18.04.2020',
            initial:true,
            positions:{
                x:0,
                y:0,
                x2:0,
                y2:0,
                data:{}
            }
        }
    }

    active(pos,data,e){
        let num=pos.num;

        var offsets = document.getElementById('center').getBoundingClientRect();
        
        var top = offsets.top;
        var left = offsets.left;
        
        let positionx=0;
        let positiony=30;

        var offset = document.getElementById('homePageContent').getBoundingClientRect();

        let initial=this.state.initial;

        if(num<8){
            // positionx=(e.clientX-500);
            positionx=(offset.width*0.7);
            positiony=offset.height-200;
        }

        if(num<17&&num>7){
            positionx=offset.width*0.1;
            positiony=offset.height-200;
        }

        if(num<26&&num>16){
            positionx=offset.width*0.1;
            positiony=30;
        }

        if(num>25){
            positionx=(offset.width*0.7);
            positiony=30;
        }



        // Mobile devices
        if(document.documentElement.clientWidth<1050){
            if(num<8){
                // positionx=(e.clientX-500);
                positionx=offset.width*0.1;
                positiony=offset.height-200;
            }

            if(num>25){
                positionx=offset.width*0.1;
                positiony=30;
            }
        }

        if(data.initial===true){
            positiony=offset.height/2-60;
            positionx=offset.width/2-200;
            initial=false;
        }

        this.setState({
            positions:{
                x: positionx,
                y:positiony,
                x2:left+pos.x2,
                y2:top+pos.y2,
                num:num,
                data:data,
            },
            initial:initial
        })
    }

    render() {

        return (
            <div  id='homePageContent'> 

                    <Animation active={this.active.bind(this)}/>
                   
                    <MainSVG 
                        positions={this.state.positions}
                    />
                    
                    <Divergency 
                        positions={this.state.positions}
                        initial={this.state.initial}
                    />
                    
            </div>
        )
    }
}

export default Reheboam
