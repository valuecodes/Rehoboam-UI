import React, { Component } from 'react'
import Hexagon from './svg/hexagon.js'
import { Spring } from 'react-spring/renderprops';

export class MainSVG extends Component {

    constructor() {
        super();
        this.state = {
            positions:{},
            targetHexagon:[16,36,42],
            target:'',
            open:'open'
        }
    }

    componentDidUpdate() {
        
        if(JSON.stringify(this.props.positions)!==JSON.stringify(this.state.positions)){
            this.changeOpen(this);
            this.setState({
                positions:this.props.positions,
                open:'open'
            })
        }        
    }

    changeOpen(){
        setTimeout(()=>{ 
            this.setState({
                open:'close'
            })
         }, 5000);
    }

    render() {

        let x=this.props.positions.x;
        let y=this.props.positions.y;
        // let x2=this.props.positions.x2;
        // let y2=this.props.positions.y2;
        return (
            <div className='mainSVGcontainer'>
                
                <Spring

                            from={{
                                x: this.state.open==='open'?-1800:0,
                                size16:this.state.open==='open'?0:16,
                                size36:this.state.open==='open'?0:36,
                                size42:this.state.open==='open'?0:42,
                                r:0,
                                opacity:this.state.open==='open'?0:1
                            }}

                            delay={
                                1000
                            } 

                            to={{
                                x: this.state.open==='open'?0:1800,
                                size16:this.state.open==='open'?16:0,
                                size36:this.state.open==='open'?36:0,
                                size42:this.state.open==='open'?42:0,
                                r:1.5,
                                opacity:this.state.open==='open'?1:0
                            }}


                            config={{duration: 1000}}
                            key={this.state.positions.num}

                        >
                            {props => (
                                <svg className='mainSvg' width="100%" height="100%">

                                    <line id='svgLine'
                                        x2={this.props.positions.x +(this.props.positions.x<1000?+300:100)}
                                        y2={this.props.positions.y+ (this.props.positions.y>400?-0:100)} 
                                        x1={this.props.positions.x2} 
                                        y1={this.props.positions.y2} 
                                        style={{
                                            stroke:'black',
                                            strokeWidth:1,
                                            strokeDashoffset:props.x
                                        }} 
                                        />
                                            <polyline className='polyLine' points={    
                                                (x+(x<1000?-0:400))+" "+
                                                (y+ (y>400?70:30))+","+                              
                                                (x+(x<1000?-10:410))+" "+
                                                (y+ (y>400?70:30))+","+

                                                (x+(x<1000?-20:420))+" "+
                                                (y+ (y>400?60:40))+","+

                                                (x+(x<1000?-20:420))+" "+
                                                (y+ (y>400?20:80))+","+

                                                (x+(x<1000?-0:400))+" "+
                                                (y+ (y>400?-0:100))+","+
                                                (x+(this.props.positions.x<1000?-0+300:400-300))+" "+
                                                (y+ (this.props.positions.y>400?-0:100))
                                                }

                                            style={{
                                                fill:"none",
                                                stroke:"rgb(124, 124, 124)",
                                                strokeWidth:2,
                                                strokeDashoffset:props.x
                                                }} />
                                        <circle cx={this.props.positions.x2} cy={this.props.positions.y2}  r={props.r} stroke="black" strokeWidth="1" 
                                        style={{
                                            opacity:props.opacity
                                        }}
                                        />
                                        <Hexagon 
                                            top={this.props.positions.y2} 
                                            left={this.props.positions.x2}
                                            opacity={props.opacity}
                                            size={props.size16}/>
                                        <Hexagon 
                                            top={this.props.positions.y2} 
                                            left={this.props.positions.x2}  
                                            opacity={props.opacity}
                                            size={props.size36}/>
                                        <Hexagon 
                                            top={this.props.positions.y2} 
                                            left={this.props.positions.x2}  
                                            opacity={props.opacity}
                                            size={props.size42}/>
                                </svg> 
                            )}
                </Spring>
            </div>
        )
    }
}

export default MainSVG
