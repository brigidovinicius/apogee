/* eslint-disable @next/next/no-img-element -- Isolated local test renderer. */
import type {ImgHTMLAttributes} from 'react';
export default function Image(props:ImgHTMLAttributes<HTMLImageElement>) { return <img {...props} alt={props.alt ?? ""} />; }
