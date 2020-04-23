import React, { Component } from 'react'
import { Spring } from 'react-spring/renderprops';

export class Animation extends Component {

constructor() {
    super();
    this.state = {
        selected:true,
        graphic:{graph1:[]}
    }
}

// componentDidMount() {

//     let graph=this.createGraph();
//     this.setState({graphic:graph});

//     this.interval = setInterval(() => this.setState({ 
//         time: Date.now(),
//         graphic:this.createGraph()
//     }), 6000);
//   }


//   componentWillUnmount() {
//     clearInterval(this.interval);
//   }

  static getDerivedStateFromProps(props,state){
        console.log(props.divergence);
        // let test=createGraph(props.divergence)
        return{
            // graphic:test
        }
  }


    render() {

        return (
            <div  className='animationContainer'>
                <div className='center'>
                    {this.state.graphic.graph1.map((elem,index)=>
                        <div key={index} className='innerBox'
                        style={{
                            transform:'rotate('+elem.degree+'deg)',
                            height:elem.active,
                            visibility:elem.visible
                            
                        }}>
                    
                        {/* <div style={{
                            height:elem.height,
                            transform:'rotate('+elem.rotate+'deg)',
                        }} className='padd1'></div> */}
                            
                    </div>

                    )}                            
                    <div className='overBox'>
                       
                    </div>    
                </div>
                      
            </div>                    

        )
    }
}

export default Animation


function getRandomInt(max) {
return Math.floor(Math.random() * Math.floor(max));
}



let createGraph=(pos)=>{
    let graphs={
        graph1:[],
        graph2:[],
    }
    
    let divergence=pos

    for(var i=0;i<35;i++){

        let height=getRandomInt(30);
        let width=0;
        let rotate=0;


        let basicRotation=-89;

        if(divergence===i-1){
            height=40;
            width=40;
            rotate=30;
        }
        if(divergence===i){
            height=40
            width=40;
            rotate=-30;
        }
        
        graphs.graph1.push({degree:((360/35)*i+basicRotation),height:height,width:width ,active:i===divergence?400:250,rotate:rotate})
        let active=false;
        graphs.graph2.push({degree:(20),height:i===divergence?160:80,width:i===divergence?60:0})
    }

    return graphs;
}