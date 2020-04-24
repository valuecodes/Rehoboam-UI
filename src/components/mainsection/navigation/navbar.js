import React, { Component } from 'react'
import { Spring } from 'react-spring/renderprops';

export class NavBar extends Component {
    render() {

        let {
            initial:initial,
            inProgress:inProgress
            }=this.props;

        return (
            <div>
                <Spring
                    from={{
                        marginTop:inProgress&&initial!==true?0:-190,
                        cancel:inProgress&&initial!==true?-190:-190
                    }}

                    to={{
                        marginTop:inProgress?-190:0,
                        cancel:inProgress?180:-190
                    }}
                    config={{mass:3, tension:600, friction:100}}
                    key={inProgress}
                    >
                    {props => (
                        <div className='navBar'
                            style={{
                            marginTop:props.marginTop
                            }}                        
                            >
                            <svg className='navSvg' height="150" width="100%">
                                <polyline points="
                                5 25, 
                                5 10, 
                                20 0, 
                                220 0, 
                                320 0,
                                " style={{fill:'none', stroke:'black',strokeWidth:1}} />
                            </svg>  
                            <button className='navButton'
                                onClick={this.props.restart}
                                >Covid 19</button>
                            <button className='navButton'
                                onClick={this.props.create}
                                >Create</button>
                            <button
                            style={{
                                marginTop:props.cancel
                            }}
                            className='navButton cancel'
                                onClick={this.props.cancel}
                                >Cancel</button>
                        </div>
                    )}
                </Spring>
            </div>
        )
    }
}

export default NavBar
