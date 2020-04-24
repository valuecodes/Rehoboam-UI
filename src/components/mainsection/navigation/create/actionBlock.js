import React, { Component } from 'react'
import { Spring } from 'react-spring/renderprops';

export class ActionBlock extends Component {



    render() {
        let {id:id,index:index}=this.props
        return (
            <div className='actionBlock'> 
            <Spring
            from={{
                x:-800,
                opacity:0,
                width:0
            }}

            to={{
                x:0,
                opacity:1,
                width:220
            }}
            config={{duration: 400}}
            >
            {props => (
                <div>
                    <div className='actionHeader'
                        style={{
                            opacity:props.opacity
                        }}
                    >
                        <h2>Event {this.props.index+1}</h2>
                        <button className='menuActionButton' onClick={this.props.deleteActionBlock.bind(this,id)}>Delete</button>                
                    </div>
                    <div className='addText'>
                        <svg className='actionBlockSVG' height="150" width="100%">
                            <polyline points="
                                5 0,
                                5 60,
                                15 70,
                                30 70,
                                30 110,
                                40 120,
                                50 120,
                                40 120, 
                                30 110, 
                                30 70, 
                                50 50, 
                                275 50
                                " style={{
                                    fill:'none',
                                    stroke:'black',
                                    strokeWidth:2,
                                    strokeDashoffset:-props.x
                                 }} />
                        </svg>
                        <div className='textInputs'
       
                        >
                            <input 
                            style={{
                                width:props.width
                            }} 
                            onChange={this.props.addData.bind(this,'Date',index)} className='addInput' placeholder='Date'></input>
                            <input
                            style={{
                                width:props.width
                            }}  
                            onChange={this.props.addData.bind(this,'Country',index)} className='addInput' placeholder='Location'></input>
                            <input
                                style={{
                                width:props.width
                            }}  onChange={this.props.addData.bind(this,'Message',index)} className='addInput' placeholder='Message'></input>
                            <input style={{
                                width:props.width
                            }}  onChange={this.props.addData.bind(this,'Add',index)} className='addInput' placeholder='Additional'></input>
                        </div>
                        <div className='addSettings'>

                        </div>
                    </div>
                </div>
            )}
            </Spring>

            </div>
        )
    }
}

export default ActionBlock

