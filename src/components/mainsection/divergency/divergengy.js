import React, { Component } from 'react'
import { Spring } from 'react-spring/renderprops';

export class Divergengy extends Component {

    constructor() {
        super();
        this.state = {
            positions:{
                x:0,
                y:0,
                x2:0,
                y2:0,
                data:{
                    Date:'',
                    Country:'',
                    Message:'',
                    Add:''
                }
            },
            data:{},
            initial:true,
            open:true,

        }
    }

    

    UNSAFE_componentWillUpdate(props){
        if(JSON.stringify(props.positions)!==JSON.stringify(this.state.positions)){
            this.changeOpen(this);
            this.setState({
                positions:props.positions,
                initial:props.positions.data.initial,
                open:'open'
            })
        }
    }

    sortData(data){     

        let dataArray={
            date:data.Date,
            location:data.Country,
            type:'Divergence',
            infoText:'TotalConfirmed',
            infoData:data.TotalConfirmed,
        }

        if(data.info){
            dataArray.add=data.info
        }

        return dataArray;
    }

    changeOpen(){
        setTimeout(()=>{ 
            this.setState({
                open:'close'
            })
         }, 5000);
    }

    render() {

        let date=this.state.positions.data.Date;
        let country=this.state.positions.data.Country;
        let message=this.state.positions.data.Message
        let add=this.state.positions.data.Add

        return (
            <div className='divergency'>

                <Spring

                from={{
                    opacity:this.state.open==='open'?0:1,
                    width:this.state.open==='open'?-10:0,
                }}

                delay={
                    2000
                }

                to={{
                    opacity:this.state.open==='open'?1:0,
                    width:this.state.open==='open'?0:10,
                }}
                config={{mass:3, tension:600, friction:100}}
                // config={{duration: 1000}}
                key={this.state.positions.num}

                >
                    {props => (
                        <div className='divergencyBlock' style={{
                            top:this.state.positions.y,
                            left:this.state.positions.x>1000?this.state.positions.x-200:this.state.positions.x,
                            textAlign:this.state.positions.x<1000?'left':'right',
                            opacity:props.opacity,
                            letterSpacing:props.width
                        }}>
                        
                            <h3 className='divDate'
                            style={{marginTop:this.state.positions.y<300?20:0}}
                            >{date}</h3>
                            
                            <h2 className='divCountry'
                            style={{
                                fontSize:country.length<30?35:20,
                                marginTop:country.length<30?0:10
                                // fontSize:20
                            }}
                            >{country}
                            </h2>                                

                            <h2 className='divMessage'
                            >
                            {/* {this.state.initial?'':'Total Confirmed cases : '} */}
                            {message}
                            </h2>
                    
                            <h2 className='divAdd'>{add}</h2>
                        </div>
                    )}
                </Spring>
            </div>
        )
    }
}

export default Divergengy








