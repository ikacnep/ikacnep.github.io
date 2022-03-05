jQuery(function($) {
	const block = $('<h1/>');
	const hint = $('<div/>');
	const again = $('<button/>').text('Ещё').css({fontSize: '2em', padding: '1em 2em'}).click(NewDate);
	block.click(() => hint.css({visibility: 'visible'}));
	$('body')
		.html($('<div/>').css({textAlign: 'center'})
			.append(block)
			.append(hint)
			.append($('<div/>').append(again).css({marginTop: 42}))
		);

	NewDate();

	function NewDate() {
		const start = new Date(1940, 0);
		const end = new Date(2000, 0);

		const date = new Date(+start + Math.random() * (end - start));

		block.text(date.toISOString().split('T')[0]);
		hint.text(date.toLocaleDateString('ru-RU', {weekday: 'long'})).css({visibility: 'hidden'});
	}
})