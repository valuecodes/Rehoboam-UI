import React, { Component } from 'react'
import ActionBlock from './actionBlock'
import { Spring } from 'react-spring/renderprops';
import { act } from 'react-dom/test-utils';

export class Create extends Component {

    constructor() {
        super();
        this.state = {
            actions:[
                {
                id:1,
                "Date": "",
                "Country":"",
                "Country2":"",
                "Type":"",
                "Location": "",
                "Message":"",
                "Add":"",
                "initial":false
                }
            ],
            id:1
        }
    }

    addNew(){
        let actions=this.state.actions;
        let newId=this.state.id+1;
        actions.push({
            id:newId,
            "Date": "",
            "Country":"",
            "Country2":"",
            "Type":"",
            "Location": "",
            "Message":"",
            "Add":"",
            "initial":false
        });
        this.setState({
            actions:actions,
            id:newId
        })
    }

    deleteActionBlock(id){
        let actions=this.state.actions;
        console.log(actions);
        let updated=actions.filter(item => item.id!==id);
        console.log(updated);
        this.setState({
            actions:updated
        })
    }

    launch(){
        this.props.launchCustom(this.state.actions);
    }

    addData(type,index,e){
        let value=e.target.value;
        let data=this.state.actions;
        data[index][type]=value;
        this.setState({
            actions:data
        })
    }

    render() {

        let {isOn:isOn,initial:initial}=this.props 
        let {actions:actions}=this.state
        console.log(actions.map(elem=>elem));
        return (

            <Spring
            from={{
                marginRight:!isOn&&initial!==true?0:-600,
            }}

            to={{
                marginRight:!isOn?-600:0
            }}
            config={{mass:5, tension:600, friction:80}}

            key={isOn}
            >
            {props => (
        
            <div className='createMenu'
                style={{
                    marginRight:props.marginRight
                }}
            >
            <div className='menuButtons'>
                <svg className='createSvg' height="100%" width="400px">
                    <polyline points={
                    "5 1505,"+ 
                    "5 15," +
                    "20 2," +
                    "220 2," +
                    "420 2,"} style={{
                        fill:'none', 
                        stroke:'black',strokeWidth:2
                    
                    }} />
                </svg>  
                <button className='menuActionButton' onClick={this.addNew.bind(this)}>Add new</button>
                <button className='menuActionButton' onClick={this.launch.bind(this)}>Launch</button>
            </div>
            <div className='createBlock'>
                {actions.map((action,index)=>
                    <ActionBlock 
                        id={action.id}
                        key={index}
                        data={action}
                        index={index}
                        deleteActionBlock={this.deleteActionBlock.bind(this)}
                        addData={this.addData.bind(this)}
                    />
                )}
            </div>
            </div>                
            )}
        </Spring>


        )
    }
}

export default Create
