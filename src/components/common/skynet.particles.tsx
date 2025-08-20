import { useRef, useEffect } from "react";
import ConnectButton from "../wallet/connect-button";

export default function SkynetParticles() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const mousePositionRef = useRef({ x: 0, y: 0 });
	const isTouchingRef = useRef(false);
	// Avoid React state here to prevent re-render loops while animating

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const updateCanvasSize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};

		updateCanvasSize();

		let particles: {
			x: number;
			y: number;
			baseX: number;
			baseY: number;
			size: number;
			color: string;
			scatteredColor: string;
			life: number;
			opacity: number;
		}[] = [];

		let textImageData: ImageData | null = null;

		function createTextImage() {
			if (!ctx || !canvas) return 0;

			ctx.fillStyle = "white";
			ctx.save();

			const isMobileLocal = window.innerWidth < 768;
			const logoHeight = isMobileLocal ? 80 : 140;
			const scale = logoHeight / 142;
			const logoWidth = 797 * scale;

			ctx.translate(
				canvas.width / 2 - logoWidth / 2,
				canvas.height / 2 - logoHeight / 2
			);
			ctx.scale(scale, scale);

			// Draw particle pattern from SVG
			const particleData = [
				{
					cx: 53.0966,
					cy: 4.77131,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 77.2519,
					cy: 4.77131,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 101.405,
					cy: 4.77131,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 28.9413,
					cy: 26.7528,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 53.0962,
					cy: 26.7514,
					rx: 5.95461,
					ry: 5.93504,
					opacity: 0.75,
				},
				{
					cx: 77.2505,
					cy: 26.7514,
					rx: 5.95461,
					ry: 5.93504,
					opacity: 0.75,
				},
				{
					cx: 101.406,
					cy: 26.7514,
					rx: 5.95461,
					ry: 5.93504,
					opacity: 0.75,
				},
				{
					cx: 125.56,
					cy: 26.7518,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 4.78704,
					cy: 48.7322,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 28.9419,
					cy: 48.7329,
					rx: 5.95461,
					ry: 5.93504,
					opacity: 0.75,
				},
				{
					cx: 53.0963,
					cy: 48.731,
					rx: 6.70669,
					ry: 6.68465,
					opacity: 1.0,
				},
				{
					cx: 77.2516,
					cy: 48.731,
					rx: 6.70669,
					ry: 6.68465,
					opacity: 1.0,
				},
				{
					cx: 101.406,
					cy: 48.731,
					rx: 6.70669,
					ry: 6.68465,
					opacity: 1.0,
				},
				{
					cx: 125.561,
					cy: 48.7329,
					rx: 5.95461,
					ry: 5.93504,
					opacity: 0.75,
				},
				{
					cx: 149.716,
					cy: 48.7322,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 4.78704,
					cy: 70.7137,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 28.9419,
					cy: 70.7134,
					rx: 5.95461,
					ry: 5.93504,
					opacity: 0.75,
				},
				{
					cx: 53.0963,
					cy: 70.7135,
					rx: 6.70669,
					ry: 6.68465,
					opacity: 1.0,
				},
				{
					cx: 77.2516,
					cy: 70.7135,
					rx: 6.70669,
					ry: 6.68465,
					opacity: 1.0,
				},
				{
					cx: 101.405,
					cy: 70.7135,
					rx: 6.70669,
					ry: 6.68465,
					opacity: 1.0,
				},
				{
					cx: 125.561,
					cy: 70.7134,
					rx: 5.95461,
					ry: 5.93504,
					opacity: 0.75,
				},
				{
					cx: 149.716,
					cy: 70.7137,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 4.78704,
					cy: 92.6942,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 28.9419,
					cy: 92.6948,
					rx: 5.95461,
					ry: 5.93504,
					opacity: 0.75,
				},
				{
					cx: 53.0963,
					cy: 92.693,
					rx: 6.70669,
					ry: 6.68465,
					opacity: 1.0,
				},
				{
					cx: 77.2516,
					cy: 92.693,
					rx: 6.70669,
					ry: 6.68465,
					opacity: 1.0,
				},
				{
					cx: 101.405,
					cy: 92.693,
					rx: 6.70669,
					ry: 6.68465,
					opacity: 1.0,
				},
				{
					cx: 125.561,
					cy: 92.6948,
					rx: 5.95461,
					ry: 5.93504,
					opacity: 0.75,
				},
				{
					cx: 149.716,
					cy: 92.6942,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 28.9413,
					cy: 114.675,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 53.0962,
					cy: 114.674,
					rx: 5.95461,
					ry: 5.93504,
					opacity: 0.75,
				},
				{
					cx: 77.2505,
					cy: 114.674,
					rx: 5.95461,
					ry: 5.93504,
					opacity: 0.75,
				},
				{
					cx: 101.406,
					cy: 114.674,
					rx: 5.95461,
					ry: 5.93504,
					opacity: 0.75,
				},
				{
					cx: 125.56,
					cy: 136.656,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 53.0966,
					cy: 136.656,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 77.2519,
					cy: 136.656,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
				{
					cx: 101.405,
					cy: 136.656,
					rx: 4.78704,
					ry: 4.77131,
					opacity: 0.5,
				},
			];

			particleData.forEach((particle) => {
				ctx.globalAlpha = particle.opacity;
				ctx.beginPath();
				ctx.ellipse(
					particle.cx,
					particle.cy,
					particle.rx,
					particle.ry,
					0,
					0,
					2 * Math.PI
				);
				ctx.fill();
			});

			ctx.globalAlpha = 1.0;

			// Draw VERCEL text from SVG paths
			ctx.beginPath();
			// V
			ctx.moveTo(761.011, 125.444);
			ctx.lineTo(739.799, 125.444);
			ctx.lineTo(739.799, 15.9854);
			ctx.lineTo(761.011, 15.9854);
			ctx.lineTo(761.011, 125.444);
			ctx.moveTo(796.337, 28.8473);
			ctx.bezierCurveTo(
				796.337,
				32.2102,
				793.611,
				34.9365,
				790.248,
				34.9365
			);
			ctx.lineTo(712.02, 34.9365);
			ctx.bezierCurveTo(
				708.657,
				34.9365,
				705.931,
				32.2102,
				705.931,
				28.8473
			);
			ctx.lineTo(705.931, 15.9854);
			ctx.lineTo(796.337, 15.9854);
			ctx.lineTo(796.337, 28.8473);

			// E
			ctx.moveTo(628.454, 125.444);
			ctx.lineTo(607.076, 125.444);
			ctx.lineTo(607.076, 15.9854);
			ctx.lineTo(628.454, 15.9854);
			ctx.lineTo(628.454, 125.444);
			ctx.moveTo(692.028, 125.444);
			ctx.lineTo(613.208, 125.444);
			ctx.lineTo(613.208, 106.493);
			ctx.lineTo(685.938, 106.493);
			ctx.bezierCurveTo(
				689.301,
				106.493,
				692.028,
				109.22,
				692.028,
				112.582
			);
			ctx.lineTo(692.028, 125.444);
			ctx.moveTo(689.542, 79.8637);
			ctx.lineTo(613.208, 79.8637);
			ctx.lineTo(613.208, 60.9126);
			ctx.lineTo(689.542, 60.9126);
			ctx.lineTo(689.542, 79.8637);
			ctx.moveTo(692.028, 28.8473);
			ctx.bezierCurveTo(
				692.028,
				32.2102,
				689.301,
				34.9365,
				685.938,
				34.9365
			);
			ctx.lineTo(613.208, 34.9365);
			ctx.lineTo(613.208, 15.9854);
			ctx.lineTo(692.028, 15.9854);
			ctx.lineTo(692.028, 28.8473);

			// R
			ctx.moveTo(516.455, 125.444);
			ctx.lineTo(495.077, 125.444);
			ctx.lineTo(495.077, 15.9854);
			ctx.lineTo(511.711, 15.9854);
			ctx.bezierCurveTo(
				515.627,
				15.9854,
				519.303,
				17.868,
				521.592,
				21.0449
			);
			ctx.lineTo(554.435, 66.6306);
			ctx.lineTo(569.184, 88.359);
			ctx.lineTo(570.841, 88.359);
			ctx.lineTo(569.847, 67.4474);
			ctx.lineTo(569.847, 15.9854);
			ctx.lineTo(591.225, 15.9854);
			ctx.lineTo(591.225, 125.444);
			ctx.lineTo(574.719, 125.444);
			ctx.bezierCurveTo(
				570.733,
				125.444,
				566.998,
				123.493,
				564.722,
				120.22
			);
			ctx.lineTo(531.039, 71.7936);
			ctx.lineTo(517.118, 51.6989);
			ctx.lineTo(515.627, 51.6989);
			ctx.lineTo(516.455, 71.3035);
			ctx.lineTo(516.455, 125.444);

			// C
			ctx.moveTo(386.243, 15.984);
			ctx.lineTo(430.605, 88.6043);
			ctx.lineTo(430.605, 125.443);
			ctx.lineTo(441.205, 125.443);
			ctx.lineTo(451.81, 125.443);
			ctx.lineTo(451.81, 88.6043);
			ctx.lineTo(496.168, 15.9839);
			ctx.lineTo(476.975, 15.9839);
			ctx.bezierCurveTo(
				472.645,
				15.9839,
				468.641,
				18.2829,
				466.458,
				22.0223
			);
			ctx.lineTo(441.205, 65.2782);
			ctx.lineTo(415.953, 22.0224);
			ctx.bezierCurveTo(413.77, 18.283, 409.765, 15.984, 405.435, 15.984);
			ctx.lineTo(386.243, 15.984);

			// E (second E)
			ctx.moveTo(231.265, 127.077);
			ctx.bezierCurveTo(
				221.273,
				127.077,
				212.83,
				125.607,
				205.935,
				122.666
			);
			ctx.bezierCurveTo(
				199.041,
				119.725,
				193.795,
				115.423,
				190.198,
				109.76
			);
			ctx.bezierCurveTo(
				186.701,
				104.096,
				184.953,
				97.1801,
				184.953,
				89.0115
			);
			ctx.lineTo(184.953, 88.0312);
			ctx.lineTo(198.285, 88.0312);
			ctx.bezierCurveTo(201.6, 88.0312, 204.122, 90.7346, 204.53, 94.024);
			ctx.bezierCurveTo(
				204.808,
				96.2667,
				205.405,
				98.4421,
				206.685,
				100.447
			);
			ctx.bezierCurveTo(
				208.284,
				102.844,
				211.031,
				104.695,
				214.928,
				106.002
			);
			ctx.bezierCurveTo(
				218.825,
				107.2,
				224.27,
				107.799,
				231.265,
				107.799
			);
			ctx.bezierCurveTo(
				237.56,
				107.799,
				242.456,
				107.364,
				245.953,
				106.492
			);
			ctx.bezierCurveTo(
				249.45,
				105.621,
				251.898,
				104.26,
				253.297,
				102.408
			);
			ctx.bezierCurveTo(
				254.696,
				100.556,
				255.395,
				98.1603,
				255.395,
				95.2196
			);
			ctx.bezierCurveTo(
				255.395,
				91.1898,
				254.196,
				88.2491,
				251.798,
				86.3975
			);
			ctx.lineTo(213.13, 77.4121);
			ctx.bezierCurveTo(
				207.434,
				76.3229,
				202.388,
				74.5803,
				197.992,
				72.1842
			);
			ctx.bezierCurveTo(
				193.695,
				69.6792,
				190.348,
				66.4117,
				187.95,
				62.3819
			);
			ctx.bezierCurveTo(
				185.652,
				58.2431,
				184.503,
				53.1786,
				184.503,
				47.1883
			);
			ctx.bezierCurveTo(
				184.503,
				43.1585,
				185.302,
				39.1831,
				186.901,
				35.2622
			);
			ctx.bezierCurveTo(
				188.5,
				31.3412,
				191.048,
				27.856,
				194.545,
				24.8064
			);
			ctx.bezierCurveTo(
				198.042,
				21.6479,
				202.588,
				19.1428,
				208.184,
				17.2913
			);
			ctx.bezierCurveTo(
				213.879,
				15.3308,
				220.823,
				14.3506,
				229.017,
				14.3506
			);
			ctx.bezierCurveTo(
				239.108,
				14.3506,
				247.352,
				15.9843,
				253.746,
				19.2517
			);
			ctx.bezierCurveTo(
				260.241,
				22.4103,
				265.087,
				26.8757,
				268.285,
				32.6482
			);
			ctx.bezierCurveTo(
				271.482,
				38.3118,
				273.081,
				44.9011,
				273.081,
				52.4162
			);
			ctx.lineTo(273.081, 53.3964);
			ctx.lineTo(259.598, 53.3964);
			ctx.bezierCurveTo(
				256.284,
				53.3964,
				253.755,
				50.6888,
				253.28,
				47.4083
			);
			ctx.bezierCurveTo(
				252.973,
				45.2854,
				252.372,
				43.2251,
				251.198,
				41.3069
			);
			ctx.bezierCurveTo(249.7, 38.693, 247.002, 36.787, 243.105, 35.5889);
			ctx.bezierCurveTo(
				239.308,
				34.2819,
				234.012,
				33.6284,
				227.218,
				33.6284
			);
			ctx.bezierCurveTo(
				221.423,
				33.6284,
				216.827,
				34.1186,
				213.429,
				35.0988
			);
			ctx.bezierCurveTo(
				210.032,
				35.9701,
				207.584,
				37.3315,
				206.085,
				39.1831
			);
			ctx.bezierCurveTo(
				204.587,
				41.0346,
				203.837,
				43.3763,
				203.837,
				46.2081
			);
			ctx.bezierCurveTo(
				203.837,
				48.822,
				204.337,
				50.9459,
				205.336,
				52.5796
			);
			ctx.bezierCurveTo(
				206.335,
				54.2133,
				207.884,
				55.5203,
				209.982,
				56.5005
			);
			ctx.bezierCurveTo(
				212.08,
				57.3718,
				214.828,
				58.1887,
				218.225,
				58.9511
			);
			ctx.lineTo(244.454, 63.8522);
			ctx.bezierCurveTo(
				251.548,
				65.0503,
				257.293,
				67.0652,
				261.69,
				69.897
			);
			ctx.bezierCurveTo(
				266.186,
				72.7288,
				269.484,
				76.214,
				271.582,
				80.3528
			);
			ctx.bezierCurveTo(
				273.68,
				84.3826,
				274.729,
				89.0115,
				274.729,
				94.2394
			);
			ctx.bezierCurveTo(
				274.729,
				99.9029,
				273.23,
				105.24,
				270.233,
				110.25
			);
			ctx.bezierCurveTo(
				267.335,
				115.26,
				262.689,
				119.344,
				256.294,
				122.503
			);
			ctx.bezierCurveTo(
				249.9,
				125.552,
				241.556,
				127.077,
				231.265,
				127.077
			);

			// L
			ctx.moveTo(388.146, 125.443);
			ctx.lineTo(369.017, 125.443);
			ctx.bezierCurveTo(
				365.014,
				125.443,
				361.267,
				123.476,
				358.993,
				120.182
			);
			ctx.lineTo(332.297, 81.4959);
			ctx.lineTo(310.332, 81.4959);
			ctx.lineTo(310.332, 61.0745);
			ctx.lineTo(331.966, 61.0745);
			ctx.lineTo(359.327, 21.2643);
			ctx.bezierCurveTo(
				361.598,
				17.9588,
				365.352,
				15.9839,
				369.363,
				15.9839
			);
			ctx.lineTo(388.477, 15.9839);
			ctx.lineTo(349.864, 69.8966);
			ctx.lineTo(388.146, 125.443);
			ctx.moveTo(316.298, 125.443);
			ctx.lineTo(294.92, 125.443);
			ctx.lineTo(294.92, 15.9839);
			ctx.lineTo(316.298, 15.9839);
			ctx.lineTo(316.298, 125.443);

			ctx.fill();
			ctx.restore();

			textImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			return scale;
		}

		function createParticle(scale: number) {
			if (!ctx || !canvas || !textImageData) return null;

			const data = textImageData.data;

			for (let attempt = 0; attempt < 100; attempt++) {
				const x = Math.floor(Math.random() * canvas.width);
				const y = Math.floor(Math.random() * canvas.height);

				if (data[(y * canvas.width + x) * 4 + 3] > 128) {
					const isMobileLocal = window.innerWidth < 768;
					const logoHeight = isMobileLocal ? 80 : 140;
					const logoWidth = 797 * (logoHeight / 142);
					const centerX = canvas.width / 2;
					const centerY = canvas.height / 2;
					const particleRegionX = centerX - logoWidth / 2;
					const isInParticleRegion =
						x >= particleRegionX &&
						x <= particleRegionX + 154 * (logoHeight / 142);

					let opacity = 1.0;
					if (isInParticleRegion) {
						const relativeY = Math.abs(y - centerY);
						const maxDistance = logoHeight / 2;
						opacity = Math.max(
							0.5,
							1.0 - (relativeY / maxDistance) * 0.5
						);
					}

					return {
						x: x,
						y: y,
						baseX: x,
						baseY: y,
						size: Math.random() * 1.5 + 0.5,
						color: "white",
						scatteredColor: "#00DCFF",
						opacity: opacity,
						life: Math.random() * 100 + 50,
					};
				}
			}

			return null;
		}

		function createInitialParticles(scale: number) {
			const baseParticleCount = 7000;
			const particleCount = Math.floor(
				baseParticleCount *
					Math.sqrt(
						(canvas?.width ?? 0) * (canvas?.height ?? 0) / (1920 * 1080)
					)
			);
			for (let i = 0; i < particleCount; i++) {
				const particle = createParticle(scale);
				if (particle) particles.push(particle);
			}
		}

		let animationFrameId: number;

		function animate(scale: number) {
			if (!ctx || !canvas) return;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = "black";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			const { x: mouseX, y: mouseY } = mousePositionRef.current;
			const maxDistance = 240;

			for (let i = 0; i < particles.length; i++) {
				const p = particles[i];
				const dx = mouseX - p.x;
				const dy = mouseY - p.y;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (
					distance < maxDistance &&
					(isTouchingRef.current || !("ontouchstart" in window))
				) {
					const force = (maxDistance - distance) / maxDistance;
					const angle = Math.atan2(dy, dx);
					const moveX = Math.cos(angle) * force * 60;
					const moveY = Math.sin(angle) * force * 60;
					p.x = p.baseX - moveX;
					p.y = p.baseY - moveY;

					ctx.fillStyle = p.scatteredColor;
				} else {
					p.x += (p.baseX - p.x) * 0.1;
					p.y += (p.baseY - p.y) * 0.1;
					ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
				}

				ctx.fillRect(p.x, p.y, p.size, p.size);

				p.life--;
				if (p.life <= 0) {
					const newParticle = createParticle(scale);
					if (newParticle) {
						particles[i] = newParticle;
					} else {
						particles.splice(i, 1);
						i--;
					}
				}
			}

			const baseParticleCount = 7000;
			const targetParticleCount = Math.floor(
				baseParticleCount *
					Math.sqrt((canvas.width * canvas.height) / (1920 * 1080))
			);
			while (particles.length < targetParticleCount) {
				const newParticle = createParticle(scale);
				if (newParticle) particles.push(newParticle);
			}

			animationFrameId = requestAnimationFrame(() => animate(scale));
		}

		const scale = createTextImage();
		createInitialParticles(scale);
		animate(scale);

		const handleResize = () => {
			updateCanvasSize();
			const newScale = createTextImage();
			particles = [];
			createInitialParticles(newScale);
		};

		const handleMove = (x: number, y: number) => {
			mousePositionRef.current = { x, y };
		};

		const handleMouseMove = (e: MouseEvent) => {
			handleMove(e.clientX, e.clientY);
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (e.touches.length > 0) {
				e.preventDefault();
				handleMove(e.touches[0].clientX, e.touches[0].clientY);
			}
		};

		const handleTouchStart = () => {
			isTouchingRef.current = true;
		};

		const handleTouchEnd = () => {
			isTouchingRef.current = false;
			mousePositionRef.current = { x: 0, y: 0 };
		};

		const handleMouseLeave = () => {
			if (!("ontouchstart" in window)) {
				mousePositionRef.current = { x: 0, y: 0 };
			}
		};

		window.addEventListener("resize", handleResize);
		canvas.addEventListener("mousemove", handleMouseMove);
		canvas.addEventListener("touchmove", handleTouchMove, {
			passive: false,
		});
		canvas.addEventListener("mouseleave", handleMouseLeave);
		canvas.addEventListener("touchstart", handleTouchStart);
		canvas.addEventListener("touchend", handleTouchEnd);

		return () => {
			window.removeEventListener("resize", handleResize);
			canvas.removeEventListener("mousemove", handleMouseMove);
			canvas.removeEventListener("touchmove", handleTouchMove);
			canvas.removeEventListener("mouseleave", handleMouseLeave);
			canvas.removeEventListener("touchstart", handleTouchStart);
			canvas.removeEventListener("touchend", handleTouchEnd);
			cancelAnimationFrame(animationFrameId);
		};
	}, []);

	return (
		<div className="relative w-full h-dvh flex flex-col items-center justify-center bg-black">
			<canvas
				ref={canvasRef}
				className="w-full h-full absolute top-0 left-0 touch-none"
				aria-label="Interactive particle effect with Vercel logo"
			/>
			<div className="absolute bottom-[100px] text-center z-10">
				<ConnectButton />
			</div>
		</div>
	);
}
