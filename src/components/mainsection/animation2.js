import React, { Component } from 'react'
import Canvas from './canvas/canvas'
import CoronaData from './data/corona.json'
import { Spring } from 'react-spring/renderprops';

export class Animation2 extends Component {

    constructor() {
        super();
        this.state = {
            positionx:0,
            positiony:0,
            lines:[1,2,3,4],
            positions:[],
            pos:{
                x1:0,
                y1:0,
                x2:1,
                y2:1,
                num:null
            },
            data:{},
            dataPosition:0,
            inProgress:true,
            initial:true,
        }
    }

    componentDidMount() {
        let data=CoronaData.data;
        let pos=[]
        let value=5.56
        for(var i=0;i<35;i++){
            pos.push({
                x1:400 + 390* Math.cos( i/value ),
                y1:400 + 390* Math.sin( i/value ),
                x2:400 + 396* Math.cos( i/value),
                y2:400 + 396* Math.sin( i/value ),
                num:i
            })
        }

        let dataPosition=this.state.dataPosition
        let selectedData=data[dataPosition];
        let firstPos=30;
        let active=pos[firstPos];
        this.props.active(active,selectedData)

        this.setState({
            positions:pos,
            pos:pos[firstPos],
            data:data
        })

        setTimeout(()=>{
            this.setState({ 
                time: Date.now(),
                pos:pos.num=-1,
                dataPosition:0,
                inProgress:false,
                initial:false,
            })

         }, 7000);
        }


    componentWillUnmount() {
        clearInterval(this.interval);
    }

    activePosition(reposition){
        let position=this.state.dataPosition+1
        let num=getRandomInt(34);
        if(reposition===true){
            num=29;
            position=1;
        }
        let data=CoronaData.data;
        let selectedData=data[position];
        
    
        


        if(selectedData.Add.length!==0){
            num=getRandomInt(16);
        }    
        
        if(selectedData.initial){
            num=2;
        }

        let pos=this.state.positions[num]
        pos.num=num;

        this.props.active(pos,selectedData)
        return pos;
        
    }

    restart(){
        this.setState({ 
            time: Date.now(),
            pos:this.activePosition(true),
            dataPosition:1,
            inProgress:true,
        })

        let data=CoronaData.data;
        this.interval = setInterval(() => {
        let inProgress=true;
        let newPos=this.state.dataPosition+1
        let pos=this.activePosition();
        if(newPos>=data.length-1){
            inProgress=false
            pos.num=-1
            clearInterval(this.interval);
        }
        this.setState({ 
            time: Date.now(),
            pos:pos,
            dataPosition:newPos,
            inProgress:inProgress
        })
    
        }, 8000);

    }

    render() {
        return (
        <div active={this.state.pos} id='center' className='mainContainer'>
            <svg  className='svgCenter' width="800px" height="800px">
                {this.state.positions.map((line,index)=>
                    <circle key={index} cx={line.x2} cy={line.y2} r="0"
                        style={{
                        r:0,
                        stroke:'black',
                    }} 
                    />
                )} 
            </svg>                
            <Canvas divergence={this.state.pos}/>


                <Spring

                from={{
                    marginTop:this.state.inProgress&&this.state.initial!==true?0:-190
                }}

                to={{
                    marginTop:this.state.inProgress?-190:0
                }}
                config={{mass:3, tension:600, friction:100}}
                key={this.state.inProgress}

                >
                    {props => (
                        <button className='startButton'
                            style={{
                            marginTop:props.marginTop
                            }}
                            onClick={this.restart.bind(this)}>Corona Timeline</button>
                    )}
                </Spring>


            </div> 

        )}
}

export default Animation2


function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}


