import React, { Component } from 'react'
import Canvas from './canvas'
import CoronaData from './../data/corona.json'
import { Spring } from 'react-spring/renderprops';
import NavBar from './../navigation/navbar'
import Create from './../navigation/create/create'

export class Animation extends Component {

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
            create:false,
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
        let selectedData={
            "Date": "21.04.20",
            "Country":"SYSTEM INIATED",
            "Country2":"",
            "Type":"",
            "Location": "",
            "Message":"UNDISCLOSED LOCATION",
            "Add":"'ABSALOM' BUILD 0.08",
            "initial":true
        };
        let firstPos=30;
        let active=pos[firstPos];
        console.log(active,selectedData,firstPos)
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

         }, 
            7000
            // 100
        );
        }


    componentWillUnmount() {
        clearInterval(this.interval);
    }

    activePosition(data,update){
        let position=this.state.dataPosition
        let num=getRandomInt(34);

        let selectedData=data[position];
        
        if(selectedData.Add.length!==0){
            num=getRandomInt(16);
        }  
        
        if(selectedData.initial){
            num=2;
        }
        
        let pos=this.state.positions[num]
        pos.num=num;

        if(update===true){
            this.props.active(pos,selectedData)
        }
        return pos;
    }

    restart(){
        let data=CoronaData.data;
        this.setState({ 
            time: Date.now(),
            pos:this.activePosition(data,true),
            dataPosition:1,
            inProgress:true,
        })
        this.interval = setInterval(() => {
        let inProgress=true;
        let newPos=this.state.dataPosition+1

        let pos={num:0}
        if(newPos>data.length){
            inProgress=false
            pos.num=-1
            clearInterval(this.interval);
            this.setState({ 
                time: Date.now(),
                pos:pos,
                dataPosition:0,
                inProgress:inProgress
            })  

        }else{
            pos=this.activePosition(data,true);
            this.setState({ 
                time: Date.now(),
                pos:pos,
                dataPosition:newPos,
                inProgress:inProgress
            })            
        }

    
        }, 8000);

    }

    create(){
        let create=this.state.create;
        create=create===false?true:false;
        this.setState({ 
            create:create
        })
    }

    launchCustom(customData){
        console.log(customData);
        this.setState({ 
            time: Date.now(),
            pos:this.activePosition(customData,true),
            dataPosition:1,
            inProgress:true,
            create:false
        })

        this.interval = setInterval(() => {
        let inProgress=true;
        let newPos=this.state.dataPosition+1
        let pos={num:0}
        
        if(newPos>customData.length){
            inProgress=false
            pos.num=-1
            this.setState({ 
                time: Date.now(),
                pos:pos,
                dataPosition:0,
                inProgress:inProgress
            })
            clearInterval(this.interval);    
        }else{
            pos=this.activePosition(customData,true);
            this.setState({ 
                time: Date.now(),
                pos:pos,
                dataPosition:newPos,
                inProgress:inProgress
            })            
        }
        }, 8000);
    }

    cancel(){
        let pos={num:0}
        let inProgress=false
        pos.num=-1
        this.setState({ 
            time: Date.now(),
            pos:pos,
            dataPosition:0,
            inProgress:inProgress
        })
        clearInterval(this.interval); 
    }

    render() {
        console.log(this.state.create)
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
            <NavBar 
                inProgress={this.state.inProgress}
                initial={this.state.initial}
                restart={this.restart.bind(this)}
                create={this.create.bind(this)}
                cancel={this.cancel.bind(this)}
            />
            <Create initial={this.state.initial} isOn={this.state.create} launchCustom={this.launchCustom.bind(this)}/>
            </div> 
        )}
}

export default Animation


function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}


