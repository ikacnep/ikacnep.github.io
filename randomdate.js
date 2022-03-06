jQuery(function($) {
	const block = $('<h1/>').css({marginTop: '2em'});
	const hint = $('<div/>');
	const again = $('<button/>').text('Ещё').css({fontSize: '2em', padding: '1em 2em'}).click(NewDate);
	const stopwatch = $('<div/>').css({color: '#333', marginTop: '1em'});
	let timer = performance.now();
	let counting = true;
	block.click(() => {
		hint.css({visibility: 'visible'});
		counting = false;
	});
	$('body')
		.html($('<div/>').css({textAlign: 'center'})
			.append(block)
			.append(hint)
			.append($('<div/>').append(again).css({marginTop: 42}))
			.append(stopwatch)
		);

	NewDate();

	setInterval(() => {
		if (counting) {
			stopwatch.text(((performance.now() - timer) / 1000).toLocaleString() + ' с');
		}
	}, 37)

	function NewDate() {
		const start = new Date(1940, 0);
		const end = new Date(2000, 0);

		const date = new Date(+start + Math.random() * (end - start));
		const iso8601 = date.toISOString().split('T')[0];

		block.text(iso8601);

		const dayOfWeek = date.toLocaleDateString('ru-RU', {weekday: 'long', timeZone: 'UTC'});
		hint.html(dayOfWeek + '<br>' + Solution(iso8601)).css({visibility: 'hidden'});

		timer = performance.now();
		counting = true;
	}

	function Solution(dateStr) {
		const [fullYear, month, day] = dateStr.split('-');
		const [century, year] = [fullYear.slice(0, 2), fullYear.slice(2, 4)];

		const calculations = [];

		if (century != 19) {
			alert('fok off, mate: century is ' + century);
			return '';
		}
		calculations.push(3);
		calculations.push(+year + (year / 4 | 0));
		const leap = (fullYear % 400 == 0) || (fullYear % 100 != 0 && year % 4 == 0);
		const monthMap = [
			leap ? 4 : 3, leap ? 1 : 0, 0, 4, 9, 6, 11, 8, 5, 10, 0, 12,
		];
		calculations.push(-monthMap[month - 1]);
		calculations.push(+day);

		return calculations.join(' + ') +
			'<br>' + calculations.map(x => x % 7).join(' + ') +
			'<br>' + '= ' + Mod7(calculations.reduce((a, b) => a + b, 0));
	}

	function Mod7(x) {
		return ((x % 7) + 7) % 7;
	}
})