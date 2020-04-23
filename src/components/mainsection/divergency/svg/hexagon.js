import React from 'react'

export default function Hexagon(props) {

	return (
				<svg className='hexagon'
						
						x={props.left-(props.size/2)}
						y={props.top-(props.size/2)}
						width={props.size} height={Math.floor(props.size)} 
						
						// strokeWidth={10}
						viewBox="0 0 485.688 485.688"
						
						>
				<g>
					<g>
					<path d="M364.269,453.155H121.416L0,242.844L121.416,32.533h242.853l121.419,210.312L364.269,453.155z M131.905,434.997h221.878
						l110.939-192.152L353.783,50.691H131.905L20.966,242.844L131.905,434.997z"/>
					</g>
			</g>
			<g>
			</g>
			<g>
			</g>
			<g>
			</g>
			<g>
			</g>
			<g>
			</g>
			<g>
			</g>
			<g>
			</g>
			<g>
			</g>
			<g>
			</g>
			<g>
			</g>
			<g>
			</g>
			<g>
			</g>
			<g>
			</g>
			<g>
			</g>
			<g>
			</g>
			</svg>
	)
}
